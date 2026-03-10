// src/app/api/items/restock/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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

export async function POST(request: Request) {
  try {
    // 1. 門番：現在のユーザーを確認
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '認証されていません' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    // 2. 注文票（Body）の検品
    const body = await request.json();
    const { itemId } = body;
    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'IDが不足、または形式が正しくありません' }, { status: 400 });
    }

    // ==========================================
    // ★ 修正：トランザクション（一連の作業をひとまとめにする）
    // アイテム補充とカウントアップの整合性を守ります
    // ==========================================
    const result = await prisma.$transaction(async (tx) => {
      
      // 3. IDOR対策：そのアイテムが本当に「そのお客様の皿」かを確認
      const item = await tx.item.findFirst({
        where: { id: itemId, userId: userId } // IDだけでなく所有者も条件に含めるのが鉄則
      });

      if (!item) {
        throw new Error('ITEM_NOT_FOUND');
      }

      const newStock = item.maxStock;
      const consumeDays = item.consumeDays || 1;
      const consumeAmount = item.consumeAmount || 1;
      const newDaysLeft = consumeAmount > 0 ? Math.floor((newStock / consumeAmount) * consumeDays) : 0;

      // 4. 在庫の満タン補充
      await tx.item.update({
        where: { id: itemId },
        data: {
          stock: newStock,
          daysLeft: newDaysLeft,
          lastAutoConsumedAt: getJstMidnight() 
        }
      });

      // 5. 昇格のロジック（経験値の付与とVIPへの招待）
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('USER_NOT_FOUND');

      let isUpgraded = false;
      const newRestockCount = user.restockCount + 1;
      
      // 補充2回で自動昇格
      const newPlan = (newRestockCount >= 2 && user.plan === 'free') ? 'pro' : user.plan;
      
      if (user.plan === 'free' && newPlan === 'pro') {
        isUpgraded = true;
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          restockCount: newRestockCount,
          plan: newPlan
        }
      });

      return { isUpgraded };
    });

    return NextResponse.json({ success: true, isUpgraded: result.isUpgraded });

  } catch (error: any) {
    if (error.message === 'ITEM_NOT_FOUND') {
      return NextResponse.json({ error: '対象の食材が見つかりませんでした' }, { status: 404 });
    }
    
    console.error('裏口からの補充エラー:', error);
    return NextResponse.json({ error: 'サーバー内でエラーが発生しました' }, { status: 500 });
  }
}