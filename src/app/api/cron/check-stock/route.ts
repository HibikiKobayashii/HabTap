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

  // ==========================================
  // ★ 修正：401で弾く前に、厨房の監視カメラ（ログ）にしっかり記録を残す！
  // ==========================================
  if (!isAuthorizedCron && !isAuthorizedUser) {
    console.error(`🚨 [Cron] 401 Unauthorized: 警備員に弾かれました。`);
    console.error(`👉 原因: 合言葉（CRON_SECRET）の不一致、またはログインセッションがありません。`);
    return new Response('Unauthorized (Pass required)', { status: 401 });
  }

  try {
    console.log('🤖 [Cron] 自動在庫チェックを開始します...');

    // 通知を探す前に、全ユーザーの「時間のネジ」を巻く（在庫を最新にする）
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    for (const user of allUsers) {
      await autoConsumeItems(user.id);
    }
    console.log('🤖 [Cron] 全ユーザーの在庫状況を最新の時間に更新しました。');

    // 「残り2日」と「残り0日」のアイテムを同時に探し出します
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
        
        // 厨房の監視カメラ（ログ）に誰に送ったかを明確に記録する
        const userName = item.user.name || item.user.email || '名無し';
        console.log(`✅ [送信成功] 宛先: ${userName} 様 | 商品: ${item.name} (残り${item.daysLeft}日)`);
        
      } catch (err) {
        const userName = item.user.name || item.user.email || '名無し';
        console.error(`❌ [送信失敗] 宛先: ${userName} 様 | ItemId: ${item.id}`, err);
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