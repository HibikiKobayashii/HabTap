// src/app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  // 1. セキュリティチェック（ログインしていない部外者のアップロードを弾く）
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    // 2. Vercel Blobに画像を保存（access: 'public' で誰でも見れるURLを生成）
    // ファイル名が被らないように、現在時刻をプレフィックスにつけます
    const filename = `${Date.now()}-${file.name}`;
    const blob = await put(filename, file, {
      access: 'public',
    });

    // 3. 保存した画像のURLをフロントエンドに返す
    return NextResponse.json(blob);
  } catch (error) {
    console.error('アップロードエラー:', error);
    return NextResponse.json({ error: '画像の保存に失敗しました' }, { status: 500 });
  }
}