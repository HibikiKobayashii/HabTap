// src/app/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
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
 * ★ 極秘の調理法：時間経過による「自動熟成」
 * ==========================================
 */
// ★ 修正：export を追加し、Cron API からも全員の時間を進められるようにしました
export async function autoConsumeItems(userId: string) {
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

export async function createItem(data: {
  name: string; stock: number; maxStock: number; daysLeft: number; 
  imageUrl: string; amazonUrl: string; consumeDays?: number; consumeAmount?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return { error: '認証が必要です' };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const currentItemCount = await prisma.item.count({ where: { userId } });

    if (user?.plan !== 'pro' && currentItemCount >= 3) {
      return { error: '無料プランの登録上限（3件）に達しております。' };
    }

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
    return { error: '登録に失敗しました' };
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
    return { error: '情報の更新に失敗しました' };
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
    return { error: "廃棄処理に失敗しました" };
  }
}

/**
 * ==========================================
 * ★ 支配人専用：管理統計
 * ==========================================
 */
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
 * ★ 支配人専用：全ユーザー情報の取得と更新
 * ==========================================
 */
export async function getAllUsers() {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== 'admin') return [];

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });
    return users;
  } catch (error) {
    console.error('ユーザー一覧取得失敗:', error);
    return [];
  }
}

export async function updateUserRolePlan(targetUserId: string, data: { role?: string, plan?: string }) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== 'admin') return { error: '権限がありません' };

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(data.role && { role: data.role }),
        ...(data.plan && { plan: data.plan }),
      }
    });
    
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('ユーザー更新失敗:', error);
    return { error: '更新に失敗しました' };
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
    await prisma.feedback.create({ data: { userId, message } });
    const admins = await prisma.user.findMany({ where: { role: 'admin', pushSubscription: { not: null } } });
    const payload = JSON.stringify({ title: 'HabiTap - Voix', body: 'お客様から新しい声が届きました。', url: '/feedback' });
    for (const admin of admins) {
      if (admin.pushSubscription) {
        try {
          const sub = JSON.parse(admin.pushSubscription);
          await webpush.sendNotification(sub, payload);
        } catch (err) { console.error('Push送信失敗:', err); }
      }
    }
    return { success: true };
  } catch (error) {
    return { error: '保存に失敗しました' };
  }
}

export async function getFeedbacks() {
  try {
    return await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }, 
      include: { user: { select: { name: true, image: true, email: true } } }
    });
  } catch (error) { return []; }
}

export async function resolveFeedback(feedbackId: string) {
  if (!feedbackId) return { error: '無効なIDです' };
  try {
    await prisma.feedback.update({ where: { id: feedbackId }, data: { isResolved: true } });
    revalidatePath('/feedback');
    return { success: true };
  } catch (error) { return { error: '更新失敗' }; }
}

export async function getBiometricStatus(userId: string) {
  if (!userId) return false;
  try {
    const authenticators = await prisma.authenticator.findMany({ where: { userId } });
    return authenticators.length > 0;
  } catch (error) { return false; }
}

export async function removeBiometricStatus(userId: string) {
  if (!userId) return { error: "IDが不明です" };
  try {
    await prisma.authenticator.deleteMany({ where: { userId } });
    return { success: true };
  } catch (error) { return { error: '解除失敗' }; }
}