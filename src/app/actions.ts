// src/app/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import * as cheerio from 'cheerio';
import webpush from 'web-push';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";

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

export async function getUserPlanAndItemCount(userId: string) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const count = await prisma.item.count({ where: { userId } });
  return { plan: user?.plan || 'free', itemCount: count };
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
  try {
    // クライアントからuserIdを渡さず、ここで確実に身元を確認します（安全性の極み）
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

/**
 * ==========================================
 * ★ 廃棄（デリート）
 * ==========================================
 */
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
 * ★ Amazonデータの調達（二段構えの究極バイパス）
 * ==========================================
 */
export async function fetchAmazonData(url: string) {
  // 1. スマホアプリの短縮URLにも完全対応
  if (!url.match(/amazon\.co\.jp|amzn\.to|amzn\.asia/i)) {
    return { error: 'AmazonのURL（amazon.co.jp, amzn.to, amzn.asia）をご提示ください' };
  }

  try {
    let finalUrl = url;

    // 2. 短縮URLを展開して、最終的な行き先（本当のURL）を割り出します
    try {
      const initialRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow'
      });
      finalUrl = initialRes.url;
    } catch (e) {
      console.warn('[厨房] URLの展開に失敗しましたが、処理を続行します', e);
    }
    
    // 3. URLの中から、商品のマイナンバーである「ASIN（10桁の英数字）」を抽出します
    const asinMatch = finalUrl.match(/(?:dp|product|asin)[/]([A-Z0-9]{10})/i) || finalUrl.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
    const asin = asinMatch ? asinMatch[1] : null;

    // ==========================================
    // 突破口 1：Yahoo!ショッピングルート（再現率：激高）
    // ==========================================
    if (asin) {
      console.log(`[厨房] ASIN(${asin})を検知。Yahoo!ルートから調達します...`);
      try {
        const yahooUrl = `https://shopping.yahoo.co.jp/search?p=${asin}`;
        const yahooRes = await fetch(yahooUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        
        if (yahooRes.ok) {
          const yahooHtml = await yahooRes.text();
          const $ = cheerio.load(yahooHtml);
          
          let name = '';
          let imageUrl = '';

          $('img').each((i, el) => {
            const src = $(el).attr('src') || '';
            const alt = $(el).attr('alt') || '';
            if (src.includes('item-shopping.c.yimg.jp') && alt.length > 5) {
              name = alt;
              imageUrl = src;
              return false; // 見つかったらループ終了
            }
          });

          if (name && imageUrl) {
             console.log(`[厨房] Yahoo!ルートでの調達に見事成功しました。`);
             return { name, imageUrl };
          }
        }
      } catch (yahooErr) {
        console.warn(`[厨房] Yahoo!ルートで予期せぬエラー:`, yahooErr);
      }
    }

    // ==========================================
    // 突破口 2：運び屋（AllOrigins）ルート
    // ==========================================
    console.log(`[厨房] Yahoo!ルート失敗。運び屋（AllOrigins）を手配しAmazon本家へ再突撃します...`);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(finalUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    const proxyData = await proxyRes.json();
    
    if (proxyData.contents) {
      const $ = cheerio.load(proxyData.contents);
      let title = $('#productTitle').text().trim() || $('title').text().replace(/^Amazon\.co\.jp\s*[:：\|]\s*/i, '').trim();
      let img = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || $('meta[property="og:image"]').attr('content');
      
      if (title && !title.includes('ボット') && title !== 'Amazon.co.jp') {
        console.log(`[厨房] 運び屋ルートでの調達に成功しました。`);
        return { name: title, imageUrl: img || '' };
      }
    }

    throw new Error('All bypass methods failed');

  } catch (error) {
    console.error('Amazonスクレイピングエラー:', error);
    return { error: 'Amazonの強固な防壁に阻まれました。お手数ですが手動でご入力いただけますでしょうか。' };
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