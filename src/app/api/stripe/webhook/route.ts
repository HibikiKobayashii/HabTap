// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// ★ あとで .env.local に追加するWebhook専用の鍵
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    // 偽物の報告を弾くための署名確認
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook署名エラー: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 決済が完了（成功）した時の処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // レジ係に預けておいた「お客様のID札」を取り出す
    const userId = session.client_reference_id;

    if (userId) {
      try {
        // ★ オーナーの設計図（schema.prisma）通りに名簿を更新！
        await prisma.user.update({
          where: { id: userId },
          data: { 
            plan: 'pro',
            proSubscribedAt: new Date(), // 現在の時間を記録
          },
        });
        console.log(`[成功] ユーザー ${userId} をPROプランへ格上げしました！`);
      } catch (dbError) {
        console.error('データベースの更新に失敗しました:', dbError);
      }
    }
  }

  // Stripeへ「報告受け取りました！」と返事をする（必須）
  return NextResponse.json({ received: true });
}