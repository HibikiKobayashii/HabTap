// src/app/feedback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, Avatar, CircularProgress, Divider, 
  IconButton, Tooltip, Chip, Snackbar, Alert, AlertColor 
} from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { getFeedbacks, resolveFeedback } from '@/app/actions';

type FeedbackData = {
  id: string;
  message: string;
  createdAt: Date | string;
  isResolved: boolean;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

export default function FeedbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as AlertColor });
  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });
  const showMessage = (msg: string, sev: AlertColor = 'info') => setSnackbar({ open: true, message: msg, severity: sev });

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') return router.push('/login');
    const isAdmin = (session?.user as any)?.role === 'admin';
    if (!isAdmin) return router.push('/');

    const fetchData = async () => {
      try {
        const data = await getFeedbacks();
        setFeedbacks(data as any);
      } catch (error) {
        console.error('データの取得に失敗しました:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [status, session, router]);

  const formatDate = (dateString: string | Date) => {
    const d = new Date(dateString);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month}月${date}日 ${hours}:${minutes}`;
  };

  const handleResolve = async (id: string) => {
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, isResolved: true } : f));
    try {
      const result = await resolveFeedback(id);
      if (result?.error) throw new Error(result.error);
      showMessage('対応済みに更新しました', 'success');
    } catch (error) {
      console.error(error);
      showMessage('状態の更新に失敗しました。', 'error');
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, isResolved: false } : f));
    }
  };

  if (loading || status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: { xs: 14, md: 16 } }}>
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ForumIcon sx={{ fontSize: 32, color: '#8E24AA' }} />
          Voix 展望室
        </Typography>

        <Typography variant="body1" sx={{ mb: 4, color: '#475569' }}>
          ここはお客様から届いた声を確認する、支配人専用の空間です。
        </Typography>

        {feedbacks.length === 0 ? (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 5, 
              borderRadius: '32px', 
              textAlign: 'center', 
              border: '1px dashed #3b82f6', // ★ 空のお皿も青い破線で縁取りました
              bgcolor: '#ffffff' 
            }}
          >
            <Typography variant="body1" color="text.secondary">
              まだ声は届いていないようです。
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {feedbacks.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: '32px',
                  border: '1px solid #3b82f6', // ★ ここが美しい青い縁取りです
                  boxShadow: '0 8px 32px rgba(59, 130, 246, 0.08)', // ★ 影にもわずかに青をブレンド
                  bgcolor: '#ffffff',
                  transition: 'all 0.3s ease',
                  ...(item.isResolved && { 
                    border: '1px solid #bbf7d0', // 対応済みは今まで通り優しき緑に
                    bgcolor: '#f8fafc',
                    boxShadow: 'none'
                  })
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, 
                  alignItems: { xs: 'flex-start', sm: 'center' }, 
                  justifyContent: 'space-between', 
                  gap: { xs: 2, sm: 0 },
                  mb: 2 
                }}>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', sm: 'auto' } }}>
                    <Avatar src={item.user.image || ''} sx={{ width: 48, height: 48 }} />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.user.name || '名無しのお客様'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.user.email}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    width: { xs: '100%', sm: 'auto' },
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    pl: { xs: 8, sm: 0 } 
                  }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: '500', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '12px' }}>
                      {formatDate(item.createdAt)}
                    </Typography>
                    
                    {!item.isResolved ? (
                      <Tooltip title="対応済みにする" placement="top">
                        <IconButton 
                          onClick={() => handleResolve(item.id)} 
                          size="small" 
                          sx={{ color: '#10b981', bgcolor: '#ecfdf5', '&:hover': { bgcolor: '#d1fae5' } }}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Chip label="対応済み" size="small" sx={{ bgcolor: '#f0fdf4', color: '#166534', fontWeight: 'bold', border: '1px solid #bbf7d0' }} />
                    )}
                  </Box>
                </Box>
                
                {/* 仕切り線も青いトーンに合わせて微調整しました */}
                <Divider sx={{ my: 2, borderColor: item.isResolved ? '#dbeafe' : '#dbeafe' }} />
                
                <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {item.message}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}