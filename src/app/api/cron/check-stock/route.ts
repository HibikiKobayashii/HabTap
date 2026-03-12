// src/app/api/cron/check-stock/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ★ 追加：時間を強制的に進める魔法をインポート
import { autoConsumeItems } from '@/app/actions';

webpush.setVapidDetails(
  'mailto:osomatsu287@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const isAuthorizedCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  const session = await getServerSession(authOptions);
  const isAuthorizedUser = !!session?.user;

  if (!isAuthorizedCron && !isAuthorizedUser) {
    return new Response('Unauthorized (Pass required)', { status: 401 });
  }

  try {
    console.log('🤖 [Cron] 自動在庫チェックを開始します...');

    // ==========================================
    // ★ 追加：通知を探す前に、全ユーザーの「時間のネジ」を巻く（在庫を最新にする）
    // ==========================================
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    for (const user of allUsers) {
      await autoConsumeItems(user.id);
    }
    console.log('🤖 [Cron] 全ユーザーの在庫状況を最新の時間に更新しました。');

    // ★ 修正：「残り2日」と「残り0日」のアイテムを同時に探し出します（時間は最新になっています！）
    const targetItems = await prisma.item.findMany({
      where: {
        daysLeft: { in: [0, 2] },
        user: { pushSubscription: { not: null } }
      },
      include: { user: true }
    });

    const results = { totalFound: targetItems.length, sentCount: 0, errors: [] as any[] };

    for (const item of targetItems) {
      if (!item.user.pushSubscription) continue;

      let title = '';
      let body = '';
      let type = '';

      if (item.daysLeft === 2) {
        title = 'HabiTap - 補充の予言';
        body = `「${item.name}」の在庫が残り2日分となりました。`;
        type = 'warning'; 
      } else if (item.daysLeft === 0) {
        title = 'HabiTap - 在庫切れのお知らせ';
        body = `「${item.name}」の在庫が尽きました。商品が届いていたら満タンにしてください。`;
        type = 'empty'; 
      }

      const payload = JSON.stringify({
        title,
        body,
        url: '/pantry',
        amazonUrl: item.amazonUrl,
        itemId: item.id,
        icon: item.imageUrl || '/icon-192x192.png',
        type 
      });

      try {
        const sub = JSON.parse(item.user.pushSubscription);
        await webpush.sendNotification(sub, payload);
        results.sentCount++;
      } catch (err) {
        console.error(`通知送信失敗 (ItemId: ${item.id}):`, err);
        results.errors.push({ itemId: item.id, error: String(err) });
      }
    }

    console.log(`🤖 [Cron] 巡回完了。${results.sentCount}件の通知を送信しました。`);
    return NextResponse.json({ message: '巡回完了', results });
  } catch (error) {
    console.error('Cron処理エラー:', error);
    return NextResponse.json({ error: '巡回中にトラブルが発生しました' }, { status: 500 });
  }
}