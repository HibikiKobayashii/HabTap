// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// 簡易的なレート制限のための記憶
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

// ★ 修正：Next.js 16のルールに従い、関数名を "proxy" に変更しました
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // 住所（IP）の特定
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

  // ==========================================
  // ★ 1. 聖域（顔パス）リスト
  // ==========================================
  if (
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/webauthn') ||
    pathname.startsWith('/api/stripe/webhook') || // Stripeの配達員は会員証なしで裏口へ通す
    pathname.startsWith('/api/cron') // ★ 追加：Vercelロボットも敷地内へ通す（合言葉の確認は奥のroute.tsで行う）
  ) {
    return NextResponse.next();
  }

  // 2. レート制限
  if (pathname.startsWith('/api/feedback') || pathname.startsWith('/api/items/restock')) {
    const now = Date.now();
    const limitInfo = rateLimitMap.get(ip) ?? { count: 0, lastReset: now };

    if (now - limitInfo.lastReset > 60 * 1000) {
      limitInfo.count = 0;
      limitInfo.lastReset = now;
    }

    limitInfo.count++;
    rateLimitMap.set(ip, limitInfo);

    if (limitInfo.count > 10) {
      // 画面側がクラッシュしないよう、JSONで上品にお断りします
      return NextResponse.json({ error: '注文が多すぎます。少し時間を置いてから再度お越しください。' }, { status: 429 });
    }
  }

  // 3. 認証ガード
  if (!token && pathname !== '/login') {
    if (pathname.startsWith('/api/')) {
      // ただの文字列ではなく、JSONでお断りします
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 4. ログイン済みスキップ
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 5. セキュリティ・ヘッダー
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};