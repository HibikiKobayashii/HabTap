// src/app/api/webauthn/register/options/route.ts
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';

const rpName = 'HabiTap';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, name } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: 'ユーザー情報が不足しています' }, { status: 400 });
    }

    // リクエスト元のドメイン名（rpID）を自動判別
    const host = request.headers.get('host') || 'localhost:3000';
    const rpID = host.split(':')[0]; 

    // ★ 修正：userID をバイト配列に変換せず、生の文字列のまま渡します
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userId, // ここを raw string に戻すだけで検品官（TS）は納得します
      userName: email,
      userDisplayName: name || email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // 発行したチャレンジをDBに記憶
    await prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: options.challenge }
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('生体認証のオプション生成エラー:', error);
    return NextResponse.json({ error: 'オプションの生成に失敗しました' }, { status: 500 });
  }
}