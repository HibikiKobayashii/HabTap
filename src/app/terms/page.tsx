// src/app/terms/page.tsx
'use client';
import { Box, Typography, Paper, Button, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 3 }}>戻る</Button>
      
      {/* ★ 修正：タイトルを黒（#0f172a）に完全固定 */}
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a' }}>利用規約</Typography>
      
      <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', border: '1px solid #e2e8f0', lineHeight: 1.8 }}>
        <Typography variant="body2" sx={{ mb: 3, color: '#64748b' }}>最終更新日：2026年3月11日</Typography>
        
        {/* ★ 念のため、中の見出しやテキストもテーマに左右されないよう色を固定 */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: '#0f172a' }}>第1条（本規約の適用）</Typography>
        <Typography variant="body2" sx={{ color: '#475569' }}>HabiTap（以下「本アプリ」）の利用者は、本規約に同意したものとみなされます。本アプリは個人開発のベータ版プロジェクトです。</Typography>

        <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: '#0f172a' }}>第2条（免責事項）</Typography>
        <Typography variant="body2" sx={{ color: '#475569' }}>1. 本アプリが提供する在庫予測および通知機能は、計算上のシミュレーションであり、その正確性を保証するものではありません。<br />
        2. Amazon等、外部サイトからの情報取得機能は、外部サービスの仕様変更により予告なく利用不能になる場合があります。これに起因する損害について、開発者は一切の責任を負いません。<br />
        3. 本アプリの利用により生じた直接的、間接的な損害（データの消失、買い忘れによる不利益等）について、開発者は予見可能性の有無を問わず、一切の賠償責任を負わないものとします。</Typography>

        <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 3, mb: 1, color: '#0f172a' }}>第3条（サービスの停止・変更）</Typography>
        <Typography variant="body2" sx={{ color: '#475569' }}>開発者は、予告なく本アプリの提供を停止、または内容を変更することができるものとします。</Typography>
      </Paper>
    </Box>
  );
}