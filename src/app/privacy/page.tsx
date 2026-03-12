// src/app/privacy/page.tsx
'use client';
import { Box, Typography, Paper, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 3 }}>戻る</Button>
      
      {/* ★ 修正：タイトルを黒（#0f172a）に完全固定 */}
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a' }}>プライバシーポリシー</Typography>
      
      <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', border: '1px solid #e2e8f0', lineHeight: 1.8 }}>
        {/* ★ 修正：見出しと本文の色を固定して、テーマ反転による視認性低下を防止 */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>1. 取得する情報</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: '#475569' }}>本アプリは、Google認証を通じてユーザーの氏名・メールアドレス・プロフィール画像を取得します。また、生体認証（WebAuthn）利用時には認証に必要な公開鍵情報をサーバーに保存します。</Typography>

        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>2. 利用目的</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: '#475569' }}>取得した情報は、本人確認、在庫管理機能の提供、およびプッシュ通知の送付にのみ利用いたします。</Typography>

        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>3. 第三者提供の禁止</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: '#475569' }}>法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。</Typography>

        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>4. データの管理</Typography>
        <Typography variant="body2" sx={{ color: '#475569' }}>お客様のデータは最新の暗号化技術を用いて保護され、ユーザー自身のリクエストによりいつでもアカウントの削除（データの抹消）が可能です。</Typography>
      </Paper>
    </Box>
  );
}