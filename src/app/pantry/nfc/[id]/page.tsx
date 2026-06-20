// src/app/pantry/nfc/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, Paper, CircularProgress, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { consumeItem, getItem } from '../../../actions';

export default function NfcConsumePage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('在庫を消費しています...');
  const [itemName, setItemName] = useState('');
  
  const hasFetched = useRef(false);

  useEffect(() => {
    async function processConsume() {
      if (!itemId || hasFetched.current) return;
      hasFetched.current = true;

      try {
        // ==========================================
        // ★ 隠し味：5秒間の「連打防止ロック（チャタリング対策）」
        // ==========================================
        const nowTime = Date.now();
        const lastConsumeKey = `last_nfc_consume_${itemId}`;
        const lastConsumeTime = localStorage.getItem(lastConsumeKey);

        if (lastConsumeTime && nowTime - parseInt(lastConsumeTime, 10) < 5000) {
          console.log('🛡️ [NFC] 5秒以内の連続アクセスを検知。二重消費防止ロックが作動しました。');
          
          // 1回目のアクセスで消費は済んでいるので、2回目以降はDBを叩かずに名前だけ取得して成功画面へ
          let savedName = '商品';
          try {
            const item = await getItem(itemId);
            if (item) {
              setItemName(item.name);
              savedName = item.name;
            }
          } catch (_) {}

          setStatus('success');
          setMessage(`「${savedName}」の在庫はすでに安全に消費されています。`);
          
          // オーナーご指定：3秒間（3000ms）表示をキープして片付ける
          setTimeout(() => {
            if (typeof window !== 'undefined') window.close();
            router.replace('/pantry');
          }, 3000);
          return;
        }

        // 初回アクセスの場合は、この瞬間のタイムスタンプを地層に刻む
        localStorage.setItem(lastConsumeKey, nowTime.toString());

        // データベースから商品名を取得
        const item = await getItem(itemId);
        if (item) setItemName(item.name);

        // 厨房への実際の消費リクエスト（1つ減らす）
        const result = await consumeItem(itemId);

        if (result?.error) {
          setStatus('error');
          setMessage(result.error);
          // エラーの場合は勝手に閉じると不親切なので、タイムアウトは設定せずボタンを押させます
        } else if (result?.success) {
          setStatus('success');
          setMessage(`「${item?.name || '商品'}」の在庫を1つ消費しました！`);

          // ==========================================
          // ★ 修正：完了画面を「3秒間（3000ms）」しっかり表示させてから片付ける
          // ==========================================
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.close(); // タブを閉じる
            }
            router.replace('/pantry'); // 閉じなかった場合の保険リダイレクト
          }, 3000);
        }
      } catch (error) {
        console.error(error);
        setStatus('error');
        setMessage('通信エラーが発生しました。');
      }
    }

    processConsume();
  }, [itemId, router]);

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
            <Typography variant="body1" sx={{ color: '#475569', mb: 1 }}>{message}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '8px' }}>
              まもなく画面が自動で閉じます (3s)
            </Typography>
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