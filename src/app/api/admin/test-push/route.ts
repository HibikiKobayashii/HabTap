// src/app/api/admin/test-push/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

const prisma = new PrismaClient();

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@habitap.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true },
    });

    if (!user || !user.pushSubscription) {
      return NextResponse.json({ error: 'プッシュ通知の宛先（購読設定）が見つかりません。先に設定をONにしてください。' }, { status: 400 });
    }

    const subscription = JSON.parse(user.pushSubscription);
    const payload = JSON.stringify({
      title: '👑 HabiTap PROへようこそ！ (テスト)',
      body: 'ご契約ありがとうございます。初回の決済は「翌月1日」より開始されます。ご契約内容はアカウントページ、またはStripeからのご案内からいつでもご確認いただけます。',
    });

    await webpush.sendNotification(subscription, payload);
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Test Push Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}