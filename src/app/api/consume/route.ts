// src/app/api/consume/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    // 1. 注文票（Body）の検品
    const body = await request.json();
    const { itemId, secretKey } = body;

    if (!itemId || !secretKey) {
      return NextResponse.json(
        { error: '必要な情報（itemId または secretKey）が不足しています' },
        { status: 400 }
      );
    }

    // 2. 門番：他人が勝手に叩けないように環境変数の合言葉と照合
    // ※ .env に設定する「NFC_SECRET_KEY」と一致するかチェックします
    if (secretKey !== process.env.NFC_SECRET_KEY) {
      console.error(`🚨 [NFC API] 401 Unauthorized: 不正な合言葉でのアクセスを検知しました。`);
      return NextResponse.json({ error: '合言葉が一致しません（Unauthorized）' }, { status: 401 });
    }

    // 3. 対象の食材が厨房（データベース）にあるか確認
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: '対象の食材が見つかりませんでした' }, { status: 404 });
    }

    if (item.stock <= 0) {
      return NextResponse.json({ error: '在庫はすでに底を突いております' }, { status: 400 });
    }

    // 4. 在庫を1つ減らし、残り日数（daysLeft）も美しく再計算
    const newStock = item.stock - 1;
    
    // 割り算の安全性を考慮しつつ、新しい残り日数を算出
    const consumeDays = item.consumeDays || 1;
    const consumeAmount = item.consumeAmount || 1;
    const newDaysLeft = consumeAmount > 0 
      ? Math.floor((newStock / consumeAmount) * consumeDays) 
      : 0;

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        stock: newStock,
        daysLeft: newDaysLeft
      }
    });

    // 5. 画面のキャッシュを新鮮な状態に戻す（おもてなしのリアルタイム更新）
    revalidatePath('/');
    revalidatePath('/pantry');

    console.log(`📱 [NFC消費成功] 商品: ${item.name} | 新しい在庫: ${newStock}個 (残り${newDaysLeft}日)`);

    return NextResponse.json({
      success: true,
      message: `「${item.name}」の在庫を1つ消費しました`,
      item: {
        name: updatedItem.name,
        stock: updatedItem.stock,
        daysLeft: updatedItem.daysLeft
      }
    });

  } catch (error) {
    console.error('NFC専用API内で深刻なエラー:', error);
    return NextResponse.json(
      { error: 'サーバー内で予期せぬエラーが発生いたしました' },
      { status: 500 }
    );
  }
}