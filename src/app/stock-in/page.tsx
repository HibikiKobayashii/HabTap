// src/app/stock-in/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, TextField, Button, Paper, CircularProgress, Avatar, Divider, IconButton
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';

import { createItem, getUserPlanAndItemCount } from '../actions';

export default function StockInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);

  // ★ 修正：imageUrlを消し、代わりに画像ファイル本体とプレビューURLを管理
  const [formData, setFormData] = useState({
    name: '', stock: '', maxStock: '', consumeDays: '1', consumeAmount: '1', amazonUrl: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // ★ 追加：画像が選択されたときの処理（プレビューの作成）
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleUpgradeToPro = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        alert('決済画面の準備に失敗しました。');
      }
    } catch (error) {
      console.error(error);
      alert('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return alert("ログインが必要です");

    // ToDoリストにあった「名前・画像のアップロードを必須化」をここで担保します
    if (!imageFile) {
      return alert("商品の画像をアップロードしてください。");
    }

    setLoading(true);
    try {
      // 1. まずVercel Blobに画像をアップロードする
      let uploadedImageUrl = '';
      const uploadFormData = new FormData();
      uploadFormData.append('file', imageFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) throw new Error("画像のアップロードに失敗しました");
      const uploadData = await uploadRes.json();
      uploadedImageUrl = uploadData.url; // Blobから発行された本番URLを取得

      // 2. 計算処理とデータベースへの登録（取得したURLを使う）
      const currentStock = parseInt(formData.stock, 10);
      const consumeDaysNum = parseInt(formData.consumeDays, 10);
      const consumeAmountNum = parseInt(formData.consumeAmount, 10);
      const calculatedDaysLeft = consumeAmountNum > 0 ? Math.floor((currentStock / consumeAmountNum) * consumeDaysNum) : 0;

      const result = await createItem({
        name: formData.name, 
        stock: currentStock, 
        maxStock: parseInt(formData.maxStock, 10),
        daysLeft: calculatedDaysLeft, 
        consumeDays: consumeDaysNum, 
        consumeAmount: consumeAmountNum,
        imageUrl: uploadedImageUrl, // ★ 取得した Blob URL を保存！
        amazonUrl: formData.amazonUrl,
      });

      if (result?.error) {
        alert(result.error);
        if (result.error.includes('上限')) setIsLimitReached(true);
        return;
      }

      router.push('/pantry');
    } catch (error) {
      console.error(error);
      alert("仕入れに失敗しました");
    } finally {
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
      
      <Typography variant="h4" sx={{ color: '#0f172a', mb: 4, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5, fontSize: { xs: '1.5rem', sm: '2.125rem' }, whiteSpace: 'nowrap' }}>
        <LocalShippingIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: 'primary.main' }} /> 新しい消耗品の仕入れ
      </Typography>

      {isLimitReached ? (
        <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, borderRadius: '32px', border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#f8fafc' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><Avatar sx={{ bgcolor: '#e2e8f0', width: 64, height: 64 }}><LockOutlinedIcon sx={{ fontSize: 32, color: '#475569' }} /></Avatar></Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: '#0f172a' }}>無料版はここまでです</Typography>
          <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.8 }}>
            4個以上の商品を追加する場合は、PRO版にアップグレードしてください。
          </Typography>
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleUpgradeToPro} 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <WorkspacePremiumIcon />}
            sx={{ borderRadius: '24px', fontWeight: 'bold', px: 4, py: 1.5, bgcolor: '#D4AF37', '&:hover': { bgcolor: '#b5952f' }, mb: 3, width: '100%', maxWidth: '340px' }}
          >
            {loading ? '準備中...' : 'PRO版にアップグレードする'}
          </Button>
          <Box>
            <Button variant="text" onClick={() => router.push('/pantry')} sx={{ color: '#64748b', fontWeight: 'bold' }}>
              パントリーへ戻る
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              
              {/* ★ 新設：画像アップロードエリア */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 2, width: '100%', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ImageIcon fontSize="small" /> 商品の画像 <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                
                {imagePreview ? (
                  <Box sx={{ position: 'relative', width: 160, height: 160, borderRadius: '24px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <IconButton 
                      onClick={handleClearImage}
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' } }}
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Button
                    component="label"
                    sx={{
                      width: '100%', maxWidth: 300, height: 160, border: '2px dashed #cbd5e1', borderRadius: '24px',
                      display: 'flex', flexDirection: 'column', gap: 1, color: '#64748b', bgcolor: '#f8fafc',
                      '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 40, color: '#94a3b8' }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>画像をアップロード</Typography>
                    <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                  </Button>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EditNoteIcon fontSize="small" /> 商品名 <span style={{ color: '#ef4444' }}>*</span>
                </Typography>
                <TextField placeholder="例: カレーメシ ビーフ" name="name" value={formData.name} onChange={handleChange} required fullWidth sx={textFieldSx} />
              </Box>

              <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 2 }}>商品情報（任意）</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LinkIcon fontSize="small" /> 購入先のURL
                  </Typography>
                  <TextField placeholder="https://www.amazon.co.jp/... (補充ボタンのリンクになります)" name="amazonUrl" value={formData.amazonUrl} onChange={handleChange} fullWidth sx={textFieldSx} />
                </Box>
              </Box>
              
              <Divider sx={{ borderColor: '#e2e8f0' }} />

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