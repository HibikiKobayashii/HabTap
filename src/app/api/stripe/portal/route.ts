// src/app/api/stripe/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
    }

    // 1. 金庫（DB）から、お客様の「預かり札（stripeCustomerId）」を探す
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ error: '顧客情報（Stripe ID）が見つかりません。' }, { status: 404 });
    }

    // 2. 用事が済んだ後、お客様が元の席（HabiTapのアカウント画面）に戻れるように帰り道をセットする
    const returnUrl = `${req.headers.get('origin')}/account`;

    // 3. Stripeに「このお客様専用のポータルURLを発行してくれ」と依頼する
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    // 4. 発行されたURLをフロントエンドに返す
    return NextResponse.json({ url: portalSession.url });

  } catch (error: any) {
    console.error('Stripe Portal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}