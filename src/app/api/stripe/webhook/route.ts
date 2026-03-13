// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

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
    // ★ 1. 新規に決済が完了した時（初月）
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const customerId = session.customer; // Stripeが発行した「顧客ID」

      if (userId && customerId) {
        // PROプランへ昇格させつつ、顧客IDを金庫にしまう
        await prisma.user.update({
          where: { id: userId },
          data: { 
            plan: 'pro',
            stripeCustomerId: customerId, // 追加！
          },
        });
        console.log(`✅ User ${userId} upgraded to PRO! CustomerID: ${customerId}`);
      }
      break;
    }

    // ★ 2. 2回目以降の自動決済が成功した時
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any;
      console.log(`✅ Invoice payment succeeded for customer: ${invoice.customer}`);
      // （※すでにPROなのでDB更新は不要。記録として残します）
      break;
    }

    // ★ 3. サブスクリプションが解約された時（追加仕込み！）
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      if (customerId) {
        try {
          // 顧客IDを手掛かりに、ユーザーを「無料プラン」へ降格させる
          await prisma.user.update({
            where: { stripeCustomerId: customerId },
            data: { plan: 'free' },
          });
          console.log(`🔻 User with CustomerID ${customerId} downgraded to FREE.`);
        } catch (error) {
          console.error(`Error downgrading customer ${customerId}:`, error);
        }
      }
      break;
    }

    default:
      console.log(`🌀 Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}