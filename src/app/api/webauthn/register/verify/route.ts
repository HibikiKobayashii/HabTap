// src/app/api/webauthn/register/verify/route.ts
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, response } = body;

    if (!userId || !response) {
      return NextResponse.json({ error: '無効なリクエストです' }, { status: 400 });
    }

    // 1. 先ほどお客様（ブラウザ）に渡した「合言葉（チャレンジ）」をDBから取り出す
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentChallenge: true }
    });

    if (!user || !user.currentChallenge) {
      return NextResponse.json({ error: '認証セッションが見つかりません。もう一度お試しください。' }, { status: 400 });
    }

    // 2. リクエスト元のドメイン名（rpID）とURL（origin）を特定
    // ※ローカル環境（localhost）と本番環境（Vercel）の両方で美しく動くための隠し味です
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    const rpID = host.split(':')[0];

    // 3. 端末から送られてきた顔/指紋データを、専用の鑑定器で審査する
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

      // 4. 特殊な生データ（Uint8Array）を、DBに保存できる美しい文字列（Base64）に変換
      const base64PublicKey = Buffer.from(credentialPublicKey).toString('base64');
      const base64CredentialID = Buffer.from(credentialID).toString('base64');

      // 5. 審査に合格したら、その鍵を金庫（Authenticatorテーブル）に厳重に保管
      await prisma.authenticator.create({
        data: {
          userId: userId,
          credentialID: base64CredentialID,
          credentialPublicKey: base64PublicKey,
          counter: counter,
          transports: response.response.transports ? response.response.transports.join(',') : '',
        }
      });

      // 防犯のため、一度使った合言葉（チャレンジ）は破棄する
      await prisma.user.update({
        where: { id: userId },
        data: { currentChallenge: null }
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: '生体データの審査に不合格となりました' }, { status: 400 });
    }
  } catch (error) {
    console.error('生体認証の審査エラー:', error);
    return NextResponse.json({ error: 'サーバー内でエラーが発生しました' }, { status: 500 });
  }
}