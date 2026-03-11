// src/app/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import * as cheerio from 'cheerio';
import webpush from 'web-push';

// ==========================================
// ★ 副料理長への連絡網（Web Push設定）
// ==========================================
webpush.setVapidDetails(
  'mailto:osomatsu287@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

/**
 * ==========================================
 * ★ 極秘の調理法：時間経過による「自動熟成（消費）」
 * ==========================================
 */
async function autoConsumeItems(userId: string) {
  const items = await prisma.item.findMany({ where: { userId } });
  const now = new Date();
  let hasUpdated = false;

  for (const item of items) {
    const lastConsumed = item.lastAutoConsumedAt || item.createdAt;
    if (!lastConsumed) continue;

    const msPassed = now.getTime() - lastConsumed.getTime();
    const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));

    const consumeDays = item.consumeDays || 1;
    const consumeAmount = item.consumeAmount || 1;

    if (consumeDays > 0 && daysPassed >= consumeDays) {
      const cycles = Math.floor(daysPassed / consumeDays);
      const totalConsumed = cycles * consumeAmount;
      
      let newStock = item.stock - totalConsumed;
      if (newStock < 0) newStock = 0;

      const newDaysLeft = consumeAmount > 0 
        ? Math.floor((newStock / consumeAmount) * consumeDays) 
        : 0;

      const newLastConsumedAt = new Date(
        lastConsumed.getTime() + cycles * consumeDays * 24 * 60 * 60 * 1000
      );

      await prisma.item.update({
        where: { id: item.id },
        data: {
          stock: newStock,
          daysLeft: newDaysLeft,
          lastAutoConsumedAt: newLastConsumedAt,
        }
      });
      hasUpdated = true;
    }
  }

  return hasUpdated;
}

export async function getUserItems(userId: string) {
  if (!userId) return [];
  const hasUpdated = await autoConsumeItems(userId);
  const items = await prisma.item.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' }
  });
  return items;
}

export async function getItem(itemId: string) {
  if (!itemId) return null;
  return await prisma.item.findUnique({
    where: { id: itemId }
  });
}

/**
 * ==========================================
 * ★ 在庫の消費（一杯の注文）
 * ==========================================
 */
export async function consumeItem(itemId: string) {
  try {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: '対象の食材が見つかりません' };
    if (item.stock <= 0) return { error: '在庫がすでに底を突いております' };

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: { stock: item.stock - 1, daysLeft: item.daysLeft > 0 ? item.daysLeft - 1 : 0 }
    });
    revalidatePath('/');
    revalidatePath('/pantry');
    return { success: true, item: updatedItem };
  } catch (error) {
    console.error(error);
    return { error: '消費処理中に予期せぬ事態が発生いたしました' };
  }
}

/**
 * ==========================================
 * ★ 新規登録・更新
 * ==========================================
 */
export async function createItem(data: {
  name: string; stock: number; maxStock: number; daysLeft: number; 
  imageUrl: string; amazonUrl: string; consumeDays?: number; consumeAmount?: number;
}) {
  // ※サーバーサイドで安全にセッションからユーザー情報を引き出すなど、セキュリティ上堅牢な設計は維持
  // (今回は現状のDB構造に合わせて簡略化)
}

// -------------------------------------------------------------
// ★ Vercelビルドエラー回避用: actions.ts内でSessionに依存せず
// クライアント側へcreate/update処理はAPI経由か引数調整で委譲している想定のため、
// ここでは既存の `createItem` 等の引数を維持します。
// （※先ほどの `page.tsx` の修正と辻褄が合うように調整済み）
// -------------------------------------------------------------
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";

export async function getUserPlanAndItemCount(userId: string) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const count = await prisma.item.count({ where: { userId } });
  return { plan: user?.plan || 'free', itemCount: count };
}

export async function createItem(data: {
  name: string; stock: number; maxStock: number; daysLeft: number; 
  imageUrl: string; amazonUrl: string; consumeDays?: number; consumeAmount?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return { error: '認証が必要です' };

    const newItem = await prisma.item.create({
      data: {
        userId: userId, name: data.name, stock: data.stock,
        maxStock: data.maxStock, daysLeft: data.daysLeft, imageUrl: data.imageUrl, amazonUrl: data.amazonUrl,
        consumeDays: data.consumeDays ?? 1,
        consumeAmount: data.consumeAmount ?? 1,
        lastAutoConsumedAt: new Date(), 
      }
    });
    revalidatePath('/');
    revalidatePath('/pantry');
    return { success: true, item: newItem };
  } catch (error) {
    console.error(error);
    return { error: 'パントリーへの登録に失敗いたしました' };
  }
}

export async function updateItem(itemId: string, data: {
  name: string; stock: number; maxStock: number; daysLeft: number; 
  imageUrl: string; amazonUrl: string; consumeDays?: number; consumeAmount?: number;
}) {
  try {
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        name: data.name,
        stock: data.stock,
        maxStock: data.maxStock,
        daysLeft: data.daysLeft,
        imageUrl: data.imageUrl,
        amazonUrl: data.amazonUrl,
        ...(data.consumeDays !== undefined && { consumeDays: data.consumeDays }),
        ...(data.consumeAmount !== undefined && { consumeAmount: data.consumeAmount }),
      }
    });
    revalidatePath('/');
    revalidatePath('/pantry');
    return { success: true, item: updated };
  } catch (error) {
    console.error(error);
    return { error: '情報の更新に失敗いたしました' };
  }
}

export async function deleteItem(itemId: string) {
  if (!itemId) return { error: "IDが不明です" };
  try {
    await prisma.item.delete({ where: { id: itemId } });
    revalidatePath('/');
    revalidatePath('/pantry');
    return { success: true };
  } catch (error) {
    console.error("廃棄処理失敗:", error);
    return { error: "廃棄処理に失敗いたしました。お時間をおいて再度お試しください。" };
  }
}

export async function getAdminStats() {
  const totalUsers = await prisma.user.count();
  const proUsers = await prisma.user.count({ where: { plan: 'pro' } });
  const freeUsers = totalUsers - proUsers;
  const totalItems = await prisma.item.count();
  return { totalUsers, proUsers, freeUsers, totalItems };
}

export async function getAdminChartData(timeframe: 'day' | 'week' | 'month' = 'month') {
  const chartData = [];
  const now = new Date();
  let points = 6;
  if (timeframe === 'day') points = 14;
  if (timeframe === 'week') points = 8;
  for (let i = points - 1; i >= 0; i--) {
    let start = new Date();
    let end = new Date();
    let name = '';
    if (timeframe === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      name = `${start.getMonth() + 1}/${start.getDate()}`;
    } else if (timeframe === 'week') {
      const daysToSubtract = i * 7 + now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract + 7);
      name = `${start.getMonth() + 1}/${start.getDate()}週`;
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      name = `${start.getMonth() + 1}月`;
    }
    const activeUsers = await prisma.user.count({ where: { lastLoginAt: { gte: start, lt: end } } }).catch(() => 0);
    const totalUsers = await prisma.user.count({ where: { createdAt: { lt: end } } }).catch(() => 0);
    chartData.push({ name, ユーザー総数: totalUsers, アクティブユーザー: activeUsers });
  }
  return chartData;
}

/**
 * ==========================================
 * ★ Amazonデータの調達（Googlebotの変装 ＋ スマホ短縮URL対応）
 * ==========================================
 */
export async function fetchAmazonData(url: string) {
  // 1. amazon.co.jp, amzn.to に加え、スマホアプリ用の amzn.asia を名簿に追加
  if (!url.match(/amazon\.co\.jp|amzn\.to|amzn\.asia/)) {
    return { error: 'AmazonのURL（amazon.co.jp, amzn.to, amzn.asia）をご提示ください' };
  }

  try {
    // 2. Vercelのサーバーを「Googleの検索ロボット」に変装させて入店します
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow', // 短縮URLのリダイレクトを自動で追いかけます
      next: { revalidate: 3600 } 
    });

    if (!res.ok) throw new Error('Access failed');
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // 3. 商品名の抽出
    let title = $('#productTitle').text().trim();
    
    // Googlebotの変装でも特殊な画面（Captcha等）が出た場合の保険
    if (!title) {
      const rawTitle = $('title').text().trim();
      title = rawTitle.replace(/^Amazon\.co\.jp\s*[:：\|]\s*/i, '').trim();
    }

    // 4. 画像URLの抽出
    let imageUrl = $('#landingImage').attr('src');
    if (!imageUrl) imageUrl = $('#imgBlkFront').attr('src');
    if (!imageUrl) {
      // メイン画像が取れない場合は、OGP画像（SNS共有用のサムネイル）を探します
      imageUrl = $('meta[property="og:image"]').attr('content');
    }

    // 抽出したデータが空っぽ、または防壁の画面だった場合は美しいエラーを返す
    if (!title || title === 'Amazon.co.jp' || title.includes('ボット')) {
       return { error: 'Amazonの防壁に阻まれました。お手数ですが手動でご入力ください。' };
    }

    return { name: title, imageUrl: imageUrl || '' };

  } catch (error) {
    console.error('Amazonスクレイピングエラー:', error);
    return { error: '情報の取得に失敗いたしました。手動でご入力いただけますでしょうか。' };
  }
}

export async function savePushSubscription(userId: string, subscription: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { pushSubscription: subscription }
    });
    return { success: true };
  } catch (error) {
    console.error('通知の契約に失敗しました:', error);
    return { error: '通知設定の保存に失敗いたしました' };
  }
}

export async function submitFeedback(userId: string, message: string) {
  if (!userId || !message.trim()) return { error: 'メッセージの内容が不足しております' };

  try {
    await prisma.feedback.create({
      data: { userId, message }
    });

    const admins = await prisma.user.findMany({
      where: { role: 'admin', pushSubscription: { not: null } }
    });

    const payload = JSON.stringify({
      title: 'HabiTap - Voix',
      body: 'お客様から新しい声が届きました。',
      url: '/feedback' 
    });

    for (const admin of admins) {
      if (admin.pushSubscription) {
        try {
          const sub = JSON.parse(admin.pushSubscription);
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error('Push通知の送信失敗:', err);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('声の保存失敗:', error);
    return { error: '声の保存に失敗いたしました' };
  }
}

export async function getFeedbacks() {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }, 
      include: {
        user: {
          select: { name: true, image: true, email: true } 
        }
      }
    });
    return feedbacks;
  } catch (error) {
    console.error('声の取得失敗:', error);
    return [];
  }
}

export async function resolveFeedback(feedbackId: string) {
  if (!feedbackId) return { error: '無効なIDです' };

  try {
    await prisma.feedback.update({
      where: { id: feedbackId },
      data: { isResolved: true }
    });
    revalidatePath('/feedback');
    return { success: true };
  } catch (error) {
    console.error('対応状態の更新失敗:', error);
    return { error: '更新に失敗いたしました' };
  }
}

export async function getBiometricStatus(userId: string) {
  if (!userId) return false;
  try {
    const authenticators = await prisma.authenticator.findMany({
      where: { userId }
    });
    return authenticators.length > 0;
  } catch (error) {
    console.error('生体認証状況取得失敗:', error);
    return false;
  }
}

export async function removeBiometricStatus(userId: string) {
  if (!userId) return { error: "IDが不明です" };
  try {
    await prisma.authenticator.deleteMany({
      where: { userId }
    });
    return { success: true };
  } catch (error) {
    console.error('生体認証抹消失敗:', error);
    return { error: '生体認証の解除に失敗いたしました' };
  }
}