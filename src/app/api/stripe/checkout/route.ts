// src/app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    // ★ 修正：フロントから送られた userId を受け取る
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      return_url: `${origin}/account?session_id={CHECKOUT_SESSION_ID}`,
      // ★ ここが超重要：誰の決済かを後で特定するために、StripeにIDを預ける
      client_reference_id: userId,
    });

    return NextResponse.json({ clientSecret: session.client_secret });

  } catch (err: any) {
    console.error('Stripeレジ係のエラー:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}