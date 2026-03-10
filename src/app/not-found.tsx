// src/app/not-found.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Box, Typography, Button, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export default function NotFound() {
  const router = useRouter();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2, bgcolor: '#dceaf8' }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 4, md: 6 }, 
          // ★ あなたの美学：お客様を優しく包み込む32pxの丸み
          borderRadius: '32px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 40px rgba(0,0,0,0.04)',
          textAlign: 'center',
          maxWidth: 500,
          width: '100%',
          bgcolor: '#ffffff'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          {/* 空のお皿を表現するアイコン */}
          <Box sx={{ p: 3, borderRadius: '50%', bgcolor: '#f1f5f9' }}>
            <SearchOffIcon sx={{ fontSize: 64, color: '#94a3b8' }} />
          </Box>
        </Box>

        {/* ★ オーナー指定のユーモア溢れる看板 */}
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#0f172a' }}>
          おっと！？ここには何もありませんよ！！
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 5, lineHeight: 1.8 }}>
          どうやら、当レストランのメニューにはない料理をご注文されたようです。<br />
          厨房の奥まで探しましたが、該当するページ（食材）は見つかりませんでした。
        </Typography>

        {/* ★ お客様を元の席へ戻すための優しいエスコート */}
        <Button 
          variant="contained" 
          onClick={() => router.back()} 
          startIcon={<ArrowBackIcon />}
          sx={{ 
            borderRadius: '24px', 
            px: 4, 
            py: 1.5, 
            fontWeight: 'bold', 
            fontSize: '1.05rem',
            boxShadow: '0 4px 14px rgba(25, 118, 210, 0.3)'
          }}
        >
          一つ前のページに戻る
        </Button>
      </Paper>
    </Box>
  );
}