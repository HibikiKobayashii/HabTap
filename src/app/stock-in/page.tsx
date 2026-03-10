// src/app/stock-in/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, TextField, Button, Paper, CircularProgress, Tooltip, Avatar
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { createItem, fetchAmazonData, getUserPlanAndItemCount } from '../actions';

export default function StockInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [fetchingAmazon, setFetchingAmazon] = useState(false);

  const [isLimitReached, setIsLimitReached] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);

  const [formData, setFormData] = useState({
    name: '', stock: '', maxStock: '', consumeDays: '1', consumeAmount: '1', imageUrl: '', amazonUrl: '',
  });

  useEffect(() => {
    async function checkLimit() {
      if (status === 'authenticated' && session?.user) {
        const userId = (session.user as any).id;
        const statusData = await getUserPlanAndItemCount(userId);
        
        if (statusData && statusData.plan === 'free' && statusData.itemCount >= 3) {
          setIsLimitReached(true);
        }
      }
      setCheckingLimit(false);
    }
    
    if (status !== 'loading') {
      checkLimit();
    }
  }, [session, status]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFetchAmazon = async () => {
    if (!formData.amazonUrl) return alert("AmazonのURLを入力してください。");
    setFetchingAmazon(true);
    try {
      const data = await fetchAmazonData(formData.amazonUrl);
      if (data.error) alert(data.error);
      else setFormData(prev => ({ ...prev, name: data.name || prev.name, imageUrl: data.imageUrl || prev.imageUrl }));
    } catch (error) {
      alert("取得に失敗しました。手動で入力をお願いします。");
    } finally {
      setFetchingAmazon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return alert("ログインが必要です");

    setLoading(true);
    try {
      // ★ 修正：userId は actions.ts 内で getServerSession から取得するため、
      // クライアント側（ここ）からは渡さないようにしました。
      await createItem({
        name: formData.name, 
        stock: parseInt(formData.stock, 10), 
        maxStock: parseInt(formData.maxStock, 10),
        consumeDays: parseInt(formData.consumeDays, 10), 
        consumeAmount: parseInt(formData.consumeAmount, 10),
        imageUrl: formData.imageUrl, 
        amazonUrl: formData.amazonUrl,
      });
      router.push('/pantry');
    } catch (error) {
      console.error(error);
      alert("仕入れに失敗しました");
      setLoading(false);
    }
  };

  const textFieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '16px', backgroundColor: '#ffffff' } };
  const adornmentSx = { ml: 1, color: '#64748b', whiteSpace: 'nowrap', minWidth: 'fit-content' };

  if (status === 'loading' || checkingLimit) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 4, 
          fontWeight: 'bold', 
          color: '#0f172a', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          fontSize: { xs: '1.5rem', sm: '2.125rem' },
          whiteSpace: 'nowrap', 
        }}
      >
        <LocalShippingIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: 'primary.main' }} /> 新しい消耗品の仕入れ
      </Typography>

      {isLimitReached ? (
        <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, borderRadius: '32px', border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#f8fafc' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Avatar sx={{ bgcolor: '#e2e8f0', width: 64, height: 64 }}>
              <LockOutlinedIcon sx={{ fontSize: 32, color: '#475569' }} />
            </Avatar>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#0f172a' }}>
            VIP（PRO）席へのご案内
          </Typography>
          <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.8 }}>
            無料版（お通し）での仕入れは<strong>3品目</strong>までとなっております。<br />
            パントリーの品をAmazon等で注文し、届いた際に<strong>「補充ボタン」を累計2回押していただく</strong>ことで、HabiTapの熟練者として自動的にVIP（PRO版）へ昇格し、4品目以降の仕入れが解禁されます。
          </Typography>
          <Button 
            variant="contained" size="large" onClick={() => router.push('/pantry')}
            sx={{ borderRadius: '24px', fontWeight: 'bold', px: 4, py: 1.5, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
          >
            パントリーへ戻る
          </Button>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

              <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, ml: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>Amazon 商品URL</Typography>
                  <Tooltip title="URLを貼り付けて魔法のステッキを押すと情報を取得します" placement="top"><InfoOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} /></Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField placeholder="https://www.amazon.co.jp/..." name="amazonUrl" value={formData.amazonUrl} onChange={handleChange} fullWidth sx={textFieldSx} />
                  <Button
                    variant="contained" onClick={handleFetchAmazon} disabled={fetchingAmazon || !formData.amazonUrl}
                    startIcon={fetchingAmazon ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
                    sx={{ minWidth: { xs: '100%', sm: '140px' }, borderRadius: '16px', fontWeight: 'bold', bgcolor: '#475569', '&:hover': { bgcolor: '#334155' } }}
                  >
                    取得
                  </Button>
                </Box>
              </Box>
              
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>商品名 <span style={{ color: '#ef4444' }}>*</span></Typography>
                <TextField placeholder="例: カレーメシ" name="name" value={formData.name} onChange={handleChange} required fullWidth sx={textFieldSx} />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>現在の在庫数 *</Typography>
                  <TextField placeholder="例: 3" name="stock" type="number" value={formData.stock} onChange={handleChange} required fullWidth sx={textFieldSx} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>満タン時の数 *</Typography>
                  <TextField placeholder="例: 6" name="maxStock" type="number" value={formData.maxStock} onChange={handleChange} required fullWidth sx={textFieldSx} />
                </Box>
              </Box>

              <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 2, ml: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>消費のペース *</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField name="consumeDays" type="number" value={formData.consumeDays} onChange={handleChange} required InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>日間で</Typography> }} sx={{ flex: 1, ...textFieldSx }} />
                  <TextField name="consumeAmount" type="number" value={formData.consumeAmount} onChange={handleChange} required InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>個使う</Typography> }} sx={{ flex: 1, ...textFieldSx }} />
                </Box>
              </Box>

              <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '24px' }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'パントリーに仕入れる'}
              </Button>
            </Box>
          </form>
        </Paper>
      )}
    </Box>
  );
}