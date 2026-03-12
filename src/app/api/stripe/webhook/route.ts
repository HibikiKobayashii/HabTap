// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// ★ 修正ポイント：ここも最新の型に合わせます
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

// ★ あとで Vercel の環境変数に追加するWebhook専用の鍵
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Webhook signature or secret is missing');
    }
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // イベントの種類に応じて処理を分岐
  switch (event.type) {
    case 'checkout.session.completed':
    case 'invoice.payment_succeeded':
      const session = event.data.object as any;
      const userId = session.metadata?.userId;

      if (userId) {
        // ★ 決済が成功したら、ユーザーを「PRO」プランへ昇格させる
        await prisma.user.update({
          where: { id: userId },
          data: { plan: 'pro' },
        });
        console.log(`✅ User ${userId} has been upgraded to PRO!`);
      }
      break;

    default:
      console.log(`🌀 Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}