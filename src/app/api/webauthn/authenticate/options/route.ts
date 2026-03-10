// src/app/api/webauthn/authenticate/options/route.ts
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma'; // ★ 追加

export async function POST(request: Request) {
  try {
    const { email } = await request.json(); // ★ 誰の合言葉かを受け取ります
    if (!email) return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 });

    const host = request.headers.get('host') || 'localhost:3000';
    const rpID = host.split(':')[0];

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred', 
    });

    // ★ 修正：不安定なクッキーをやめ、データベースの金庫に直接合言葉を記憶させます
    await prisma.user.update({
      where: { email },
      data: { currentChallenge: options.challenge }
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('認証オプション生成エラー:', error);
    return NextResponse.json({ error: 'オプションの生成に失敗しました' }, { status: 500 });
  }
}