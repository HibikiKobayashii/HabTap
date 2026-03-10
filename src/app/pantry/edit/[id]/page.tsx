// src/app/pantry/edit/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Typography, TextField, Button, Paper, CircularProgress, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import KitchenIcon from '@mui/icons-material/Kitchen';

import { getItem, updateItem } from '../../../actions'; 

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const { data: session, status } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    stock: '',
    maxStock: '',
    daysLeft: '',
    imageUrl: '',
    amazonUrl: '',
    // ★ 追加：機能（UI）には出さないが、裏側で保持しておく「必須の隠し味」
    consumeDays: 1,
    consumeAmount: 1,
  });

  useEffect(() => {
    async function loadItem() {
      if (!itemId) return;
      try {
        const item = await getItem(itemId);
        if (item) {
          setFormData({
            name: item.name,
            stock: item.stock.toString(),
            maxStock: item.maxStock.toString(),
            daysLeft: item.daysLeft.toString(),
            imageUrl: item.imageUrl || '',
            amazonUrl: item.amazonUrl || '',
            // ★ 追加：DBから元のペース設定もしっかり引き継ぎます
            consumeDays: item.consumeDays,
            consumeAmount: item.consumeAmount,
          });
        }
      } catch (error) {
        console.error("データの読み込みに失敗しました:", error);
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [itemId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // ★ 修正：actions.ts が求めるすべての引数を揃えて差し出します
      await updateItem(itemId, {
        name: formData.name,
        stock: parseInt(formData.stock, 10),
        maxStock: parseInt(formData.maxStock, 10),
        daysLeft: parseInt(formData.daysLeft, 10),
        imageUrl: formData.imageUrl,
        amazonUrl: formData.amazonUrl,
        consumeDays: formData.consumeDays,
        consumeAmount: formData.consumeAmount,
      });
      router.push('/pantry');
    } catch (error) {
      console.error("更新に失敗しました:", error);
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const textFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      backgroundColor: '#ffffff',
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <IconButton 
          onClick={() => router.push('/pantry')} 
          sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', '&:hover': { bgcolor: '#f8fafc' } }}
        >
          <ArrowBackIcon sx={{ color: '#475569' }} />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ color: 'primary.main', fontSize: 28 }} /> 品の編集
        </Typography>
      </Box>

      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, md: 5 }, 
          borderRadius: '32px', 
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)' 
        }}
      >
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, width: '100%' }}>
              {formData.imageUrl ? (
                <Box
                  component="img"
                  src={formData.imageUrl}
                  alt={formData.name}
                  sx={{ 
                    maxWidth: '100%', 
                    maxHeight: { xs: '300px', sm: '450px' }, 
                    height: 'auto', 
                    width: 'auto', 
                    display: 'block', 
                    border: 'none', 
                    bgcolor: '#ffffff', 
                    borderRadius: '16px', 
                  }} 
                />
              ) : (
                <Box sx={{ 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', 
                  width: { xs: '120px', sm: '180px' }, 
                  height: { xs: '120px', sm: '180px' }, 
                  bgcolor: '#ffffff', 
                  color: '#cbd5e1',
                }}>
                  <KitchenIcon sx={{ fontSize: { xs: 70, sm: 100 } }} />
                </Box>
              )}
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                商品名 <span style={{ color: '#ef4444' }}>*</span>
              </Typography>
              <TextField 
                placeholder="例: カレーメシ" 
                name="name" value={formData.name} onChange={handleChange} required fullWidth sx={textFieldSx} 
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                  現在の在庫数 <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <TextField 
                  placeholder="例: 3"
                  name="stock" type="number" value={formData.stock} onChange={handleChange} required fullWidth sx={textFieldSx} 
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                  満タン時の数 <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <TextField 
                  placeholder="例: 6"
                  name="maxStock" type="number" value={formData.maxStock} onChange={handleChange} required fullWidth sx={textFieldSx} 
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                  残り何日分か <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <TextField 
                  placeholder="例: 14"
                  name="daysLeft" type="number" value={formData.daysLeft} onChange={handleChange} required fullWidth sx={textFieldSx} 
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                画像URL
              </Typography>
              <TextField 
                placeholder="Amazonの画像アドレス等を貼り付け"
                name="imageUrl" value={formData.imageUrl} onChange={handleChange} fullWidth sx={textFieldSx} 
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>
                Amazon 商品URL
              </Typography>
              <TextField 
                placeholder="https://www.amazon.co.jp/..."
                name="amazonUrl" value={formData.amazonUrl} onChange={handleChange} fullWidth sx={textFieldSx} 
              />
            </Box>

            <Button 
              type="submit" 
              variant="contained" 
              size="large" 
              disabled={submitting}
              sx={{ mt: 1, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '24px' }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : '情報を更新する'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}