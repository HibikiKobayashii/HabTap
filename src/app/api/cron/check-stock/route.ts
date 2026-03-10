// src/app/api/cron/check-stock/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:osomatsu287@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // ★ 修正：「残り2日」と「残り0日」のアイテムを同時に探し出します
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

      // ★ 残り日数に応じて、通知の「味付け（タイプ）」を変えます
      if (item.daysLeft === 2) {
        title = 'HabiTap - 補充の予言';
        body = `「${item.name}」の在庫が残り2日分となりました。`;
        type = 'warning'; // 注文を促すタイプ
      } else if (item.daysLeft === 0) {
        title = 'HabiTap - 在庫切れのお知らせ';
        body = `「${item.name}」の在庫が尽きました。商品が届いていたら満タンにしてください。`;
        type = 'empty'; // 補充を促すタイプ
      }

      const payload = JSON.stringify({
        title,
        body,
        url: '/pantry',
        amazonUrl: item.amazonUrl,
        itemId: item.id,
        icon: item.imageUrl || '/icon-192x192.png',
        type // ウェイターに教えるための合言葉
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

    return NextResponse.json({ message: '巡回完了', results });
  } catch (error) {
    console.error('Cron処理エラー:', error);
    return NextResponse.json({ error: '巡回中にトラブルが発生しました' }, { status: 500 });
  }
}