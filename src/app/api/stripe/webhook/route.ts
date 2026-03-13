// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push'; // ★ 追加：プッシュ通知用の配達員

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ★ Web Pushの初期設定（配達員の身分証をセット）
// 既存のプッシュ通知機能で使っているVAPIDキーをここで読み込みます
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@habitap.app', // 連絡先（ダミーでも動作しますが、形式上必要です）
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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
        // PROプランへ昇格させつつ、顧客IDを金庫にしまう。
        // 同時に、お客様の「プッシュ通知の宛先（pushSubscription）」も引っ張り出す。
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { 
            plan: 'pro',
            stripeCustomerId: customerId, 
          },
        });
        console.log(`✅ User ${userId} upgraded to PRO! CustomerID: ${customerId}`);

        // ★ 追加：お客様へ「歓迎のプッシュ通知」を送信
        if (updatedUser.pushSubscription) {
          try {
            const subscription = JSON.parse(updatedUser.pushSubscription);
            const payload = JSON.stringify({
              title: '👑 HabiTap PROへようこそ！',
              body: 'ご契約ありがとうございます。初回の決済は「翌月1日」より開始されます。ご契約内容はアカウントページ、またはStripeからのご案内からいつでもご確認いただけます。',
            });
            await webpush.sendNotification(subscription, payload);
            console.log('📢 歓迎のプッシュ通知を送信しました。');
          } catch (error) {
            console.error('プッシュ通知の送信エラー:', error);
          }
        }
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

    // ★ 3. サブスクリプションが解約された時
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