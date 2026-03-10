// src/app/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import * as cheerio from 'cheerio';
import webpush from 'web-push';
import { getServerSession } from 'next-auth'; // ★ 追加
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // ★ 追加

webpush.setVapidDetails(
  'mailto:osomatsu287@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

/**
 * ==========================================
 * 門番：現在のユーザーセッションを厳格に確認する
 * ==========================================
 */
async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('認証が必要です。ログインし直してください。');
  return session.user as { id: string; role: string; email: string };
}

/**
 * 日本時間の「今日の0:00」を生成する魔法
 */
function getJstMidnight() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstTime = new Date(now.getTime() + jstOffset);
  jstTime.setUTCHours(0, 0, 0, 0);
  return new Date(jstTime.getTime() - jstOffset);
}

// ---------------------------------------------------------
// 食材（アイテム）関連
// ---------------------------------------------------------

export async function autoConsumeItems(userId: string) {
  // 外部から userId を操作されないよう、内部でもセッション確認を推奨（今回は呼び出し元で制御）
  const items = await prisma.item.findMany({ where: { userId } });
  const now = getJstMidnight(); 
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
  const user = await getAuthenticatedUser();
  // ★ IDOR対策：他人のIDでリクエストされても、自分のデータしか返さない
  if (userId !== user.id) return [];

  await autoConsumeItems(user.id);
  return await prisma.item.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getItem(itemId: string) {
  const user = await getAuthenticatedUser();
  // ★ IDOR対策：自分の持ち物であることもしっかり確認
  return await prisma.item.findFirst({ 
    where: { id: itemId, userId: user.id } 
  });
}

export async function consumeItem(itemId: string) {
  try {
    const user = await getAuthenticatedUser();
    // ★ IDOR対策：他人の食材を勝手に減らさせない
    const item = await prisma.item.findFirst({ 
      where: { id: itemId, userId: user.id } 
    });
    
    if (!item) return { error: '対象の食材が見つかりません' };
    if (item.stock <= 0) return { error: '在庫がすでに底を突いております' };

    const newStock = item.stock - 1;
    const newDaysLeft = item.consumeAmount > 0 
      ? Math.floor((newStock / item.consumeAmount) * item.consumeDays) 
      : 0;

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: { stock: newStock, daysLeft: newDaysLeft }
    });
    revalidatePath('/pantry');
    return { success: true, item: updatedItem };
  } catch (error) {
    console.error(error);
    return { error: '消費処理中にエラーが発生いたしました' };
  }
}

export async function createItem(data: {
  name: string; stock: number; maxStock: number; 
  imageUrl: string; amazonUrl: string; consumeDays: number; consumeAmount: number;
}) {
  try {
    const user = await getAuthenticatedUser();
    // ★ Mass Assignment対策：userIdはクライアントから受け取らず、セッションから強制セット
    const daysLeft = Math.floor((data.stock / (data.consumeAmount || 1)) * (data.consumeDays || 1));

    const newItem = await prisma.item.create({
      data: {
        userId: user.id, 
        name: data.name, 
        stock: data.stock,
        maxStock: data.maxStock, 
        daysLeft: daysLeft, 
        imageUrl: data.imageUrl, 
        amazonUrl: data.amazonUrl,
        consumeDays: data.consumeDays, 
        consumeAmount: data.consumeAmount,
        lastAutoConsumedAt: getJstMidnight(), 
      }
    });
    revalidatePath('/pantry');
    return { success: true, item: newItem };
  } catch (error) {
    console.error(error);
    return { error: 'パントリーへの登録に失敗いたしました' };
  }
}

export async function updateItem(itemId: string, data: {
  name: string; stock: number; maxStock: number; 
  imageUrl: string; amazonUrl: string; consumeDays: number; consumeAmount: number;
  daysLeft?: number; // 手動入力用
}) {
  try {
    const user = await getAuthenticatedUser();
    // ★ IDOR対策：持ち主確認。他人のアイテムを更新させない
    const item = await prisma.item.findFirst({ where: { id: itemId, userId: user.id } });
    if (!item) return { error: '対象が見つかりません' };

    const daysLeft = data.daysLeft ?? Math.floor((data.stock / (data.consumeAmount || 1)) * (data.consumeDays || 1));
    
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        name: data.name, stock: data.stock, maxStock: data.maxStock, daysLeft: daysLeft,
        imageUrl: data.imageUrl, amazonUrl: data.amazonUrl,
        consumeDays: data.consumeDays, consumeAmount: data.consumeAmount,
      }
    });
    revalidatePath('/pantry');
    return { success: true, item: updated };
  } catch (error) {
    console.error(error);
    return { error: '情報の更新に失敗いたしました' };
  }
}

export async function deleteItem(itemId: string) {
  try {
    const user = await getAuthenticatedUser();
    // ★ IDOR対策：自分のアイテムだけを削除可能に
    const item = await prisma.item.findFirst({ where: { id: itemId, userId: user.id } });
    if (!item) return { error: "権限がありません" };

    await prisma.item.delete({ where: { id: itemId } });
    revalidatePath('/pantry');
    return { success: true };
  } catch (error) {
    console.error("廃棄処理失敗:", error);
    return { error: "廃棄処理に失敗いたしました" };
  }
}

// ---------------------------------------------------------
// 管理者専用（Admin）
// ---------------------------------------------------------

export async function getAdminStats() {
  const user = await getAuthenticatedUser();
  if (user.role !== 'admin') throw new Error('閲覧権限がございません');

  const totalUsers = await prisma.user.count();
  const proUsers = await prisma.user.count({ where: { plan: 'pro' } });
  const freeUsers = totalUsers - proUsers;
  const totalItems = await prisma.item.count();
  return { totalUsers, proUsers, freeUsers, totalItems };
}

export async function getAdminChartData(timeframe: 'day' | 'week' | 'month' = 'month') {
  const user = await getAuthenticatedUser();
  if (user.role !== 'admin') throw new Error('閲覧権限がございません');

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

// ---------------------------------------------------------
// 外部・ユーティリティ関連
// ---------------------------------------------------------

export async function fetchAmazonData(url: string) {
  if (!url.includes('amazon.co.jp') && !url.includes('amzn.to')) {
    return { error: 'AmazonのURLをご提示いただけますでしょうか' };
  }
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 } 
    });
    if (!res.ok) throw new Error('Access failed');
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('#productTitle').text().trim();
    let imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
    return { name: title || '', imageUrl: imageUrl || '' };
  } catch (error) {
    console.error('Amazonスクレイピングエラー:', error);
    return { error: '情報の取得に失敗いたしました' };
  }
}

export async function savePushSubscription(userId: string, subscription: string) {
  try {
    const user = await getAuthenticatedUser();
    if (userId !== user.id) throw new Error('不正なリクエストです');
    await prisma.user.update({
      where: { id: user.id },
      data: { pushSubscription: subscription }
    });
    return { success: true };
  } catch (error) {
    return { error: '通知設定の保存に失敗いたしました' };
  }
}

export async function submitFeedback(userId: string, message: string) {
  const user = await getAuthenticatedUser();
  if (userId !== user.id || !message.trim()) return { error: '内容が不足しております' };

  try {
    // XSS対策：Next.jsは標準でエスケープしますが、文字数制限を設けるのが三ツ星
    if (message.length > 1000) return { error: 'メッセージが長すぎます' };

    await prisma.feedback.create({ data: { userId: user.id, message } });
    const admins = await prisma.user.findMany({ where: { role: 'admin', pushSubscription: { not: null } } });
    const payload = JSON.stringify({ title: 'HabiTap - Voix', body: '新しい声が届きました。', url: '/feedback' });

    for (const admin of admins) {
      if (admin.pushSubscription) {
        try {
          const sub = JSON.parse(admin.pushSubscription);
          await webpush.sendNotification(sub, payload);
        } catch (err) { console.error('Push失敗'); }
      }
    }
    return { success: true };
  } catch (error) {
    return { error: '声の保存に失敗いたしました' };
  }
}

export async function getFeedbacks() {
  try {
    const user = await getAuthenticatedUser();
    if (user.role !== 'admin') throw new Error('権限がありません');

    return await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }, 
      include: { user: { select: { name: true, image: true, email: true } } }
    });
  } catch (error) { return []; }
}

export async function resolveFeedback(feedbackId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (user.role !== 'admin') throw new Error('権限がありません');

    await prisma.feedback.update({ where: { id: feedbackId }, data: { isResolved: true } });
    revalidatePath('/feedback');
    return { success: true };
  } catch (error) { return { error: '更新に失敗いたしました' }; }
}

export async function getBiometricStatus(userId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (userId !== user.id) return false;
    const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });
    return authenticators.length > 0;
  } catch (error) { return false; }
}

export async function removeBiometricStatus(userId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (userId !== user.id) throw new Error('権限がありません');
    await prisma.authenticator.deleteMany({ where: { userId: user.id } });
    return { success: true };
  } catch (error) { return { error: '解除に失敗いたしました' }; }
}

export async function getUserPlanAndItemCount(userId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (userId !== user.id) throw new Error('権限がありません');
    
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true }
    });
    const itemCount = await prisma.item.count({
      where: { userId: user.id }
    });
    return { plan: dbUser?.plan || 'free', itemCount };
  } catch (error) { return null; }
}