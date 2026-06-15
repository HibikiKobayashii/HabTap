// src/app/pantry/nfc/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// 既存の消費アクションをそのまま利用します
import { consumeItem, getItem } from '../../../actions';

export default function NfcConsumePage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('在庫を消費しています...');
  const [itemName, setItemName] = useState('');
  
  // Reactの「2回実行される仕様(StrictMode)」を防ぐための工夫
  const hasFetched = useRef(false);

  useEffect(() => {
    async function processConsume() {
      if (!itemId || hasFetched.current) return;
      hasFetched.current = true;

      try {
        // 商品名の取得（画面表示のため）
        const item = await getItem(itemId);
        if (item) setItemName(item.name);

        // 厨房への消費リクエスト
        const result = await consumeItem(itemId);

        if (result?.error) {
          setStatus('error');
          setMessage(result.error);
        } else if (result?.success) {
          setStatus('success');
          setMessage(`「${item?.name || '商品'}」の在庫を1つ消費しました！`);
        }
      } catch (error) {
        console.error(error);
        setStatus('error');
        setMessage('通信エラーが発生しました。');
      }
    }

    processConsume();
  }, [itemId]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f8fafc', p: 2 }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          borderRadius: '32px', 
          textAlign: 'center', 
          maxWidth: 400, 
          width: '100%',
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
        }}
      >
        {status === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={48} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ color: '#475569', fontWeight: 'bold' }}>{message}</Typography>
          </Box>
        )}

        {status === 'success' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, animation: 'fadeIn 0.5s ease-out' }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: '#10b981' }} />
            <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 'bold' }}>消費完了！</Typography>
            <Typography variant="body1" sx={{ color: '#475569', mb: 2 }}>{message}</Typography>
            <Button 
              variant="contained" 
              onClick={() => router.push('/pantry')}
              sx={{ borderRadius: '24px', px: 4, py: 1, fontWeight: 'bold' }}
            >
              パントリーへ戻る
            </Button>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ErrorOutlineIcon sx={{ fontSize: 64, color: '#ef4444' }} />
            <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 'bold' }}>エラー</Typography>
            <Typography variant="body1" sx={{ color: '#475569', mb: 2 }}>{message}</Typography>
            <Button 
              variant="outlined" 
              onClick={() => router.push('/pantry')}
              sx={{ borderRadius: '24px', px: 4, py: 1, fontWeight: 'bold' }}
            >
              パントリーへ戻る
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}