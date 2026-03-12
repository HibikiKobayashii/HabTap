// src/app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// ★ 修正ポイント：ここを最新の型に合わせ、型エラーを回避します
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any, 
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
    }

    // --- 2回目以降を「毎月1日請求」にするための時間計算 ---
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    const billingAnchor = Math.floor(nextMonth.getTime() / 1000);
    // --------------------------------------------

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: 'HabiTap PROプラン',
              description: '在庫管理の制限を解除し、無制限にアイテムを追加できます。',
            },
            unit_amount: 100, // 月額100円
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      ui_mode: 'embedded',
      
      // 決済完了後の戻り先
      return_url: `${req.headers.get('origin')}/account?session_id={CHECKOUT_SESSION_ID}`,
      
      subscription_data: {
        // ★ 次回の請求日を来月1日に固定
        billing_cycle_anchor: billingAnchor,
        proration_behavior: 'none', 
        metadata: {
          userId: userId,
        },
      },
      
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}