// src/app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { Card, CardMedia, CardContent, Typography, Button, LinearProgress, Box, CircularProgress, Chip, IconButton, Tooltip } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'; // ★ 白いお皿に乗せるベル
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getUserItems } from './actions';

type Item = {
  id: string;
  name: string;
  stock: number;
  maxStock: number;
  daysLeft: number;
  imageUrl: string | null;
  amazonUrl: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const isPro = (session?.user as any)?.plan === 'pro';
  const isAdmin = (session?.user as any)?.role === 'admin';

  useEffect(() => {
    async function fetchIngredients() {
      const userId = (session?.user as any)?.id;
      if (userId) {
        const realItems = await getUserItems(userId);
        setItems(realItems as Item[]);
      }
      setLoading(false);
    }

    if (status === 'authenticated') {
      fetchIngredients();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [session, status]);

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, pb: 12, maxWidth: 1400, mx: 'auto' }}>
      
      {/* =========================================
          ★ ヘッダー領域：左にロゴ、右に案内ベル
          ========================================= */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: '-0.02em' }}>
            HabiTap
          </Typography>
          
          {isPro ? (
            <Chip 
              label="PRO" 
              size="small"
              sx={{ bgcolor: '#D4AF37', color: '#fff', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)' }} 
            />
          ) : (
            <Chip 
              label="無料プラン" 
              size="small"
              variant="outlined"
              sx={{ color: 'primary.main', borderColor: 'primary.main', fontWeight: 'bold' }} 
            />
          )}

          {isAdmin && (
            <Chip 
              label="Admin" 
              size="small"
              sx={{ bgcolor: '#8E24AA', color: '#fff', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(142, 36, 170, 0.4)' }} 
            />
          )}
        </Box>

        {/* ★ 白い丸いお皿に乗ったベルのアイコン */}
        <Tooltip title="HabiTap Info（アップデート情報）" placement="bottom">
          <IconButton 
            onClick={() => router.push('/habitap-info')}
            sx={{ 
              bgcolor: '#ffffff', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)', 
              border: '1px solid #e2e8f0',
              '&:hover': { bgcolor: '#f8fafc', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' },
              width: 48,
              height: 48,
            }}
          >
            <NotificationsNoneOutlinedIcon sx={{ color: '#475569' }} />
          </IconButton>
        </Tooltip>
      </Box>
      
      {items.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          冷蔵庫はまだ空っぽです。下部の「パントリー」から最初の食材を仕入れてみましょう。
        </Typography>
      ) : (
        <Box 
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 4 } }}
        >
          {items.map((item) => {
            const progress = (item.stock / item.maxStock) * 100;

            return (
              <Card 
                key={item.id}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  p: { xs: 1.5, md: 3 }, 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
                  borderRadius: '32px', 
                  height: '100%' 
                }}
              >
                <CardMedia
                  component="img"
                  sx={{ 
                    width: { xs: 85, md: 140 }, 
                    height: { xs: 85, md: 140 }, 
                    objectFit: 'contain', 
                    borderRadius: '24px' 
                  }}
                  image={item.imageUrl || ''}
                  alt={item.name}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                  <CardContent sx={{ pb: '16px !important', px: { xs: 1.5, md: 3 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, fontSize: '1.1rem' }}>
                      {item.name}
                    </Typography>
                    
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1, fontWeight: '500' }}>
                      残り: {item.stock}（約{item.daysLeft}日分）
                    </Typography>
                    
                    <LinearProgress 
                      variant="determinate" 
                      value={progress} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4, 
                        mb: 2,
                        backgroundColor: '#f1f5f9', 
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: progress <= 20 ? '#ef4444' : '#84cc16',
                          borderRadius: 4,
                        }
                      }} 
                    />

                    <Button 
                      fullWidth 
                      variant="contained" 
                      color="primary"
                      size="large" 
                      component="a" 
                      href={item.amazonUrl || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      startIcon={<ShoppingCartIcon />}
                      sx={{ 
                        borderRadius: '16px', 
                        fontWeight: 'bold', 
                        py: 1,
                        opacity: item.amazonUrl ? 1 : 0.5
                      }} 
                    >
                      補充する
                    </Button>
                  </CardContent>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}