// src/app/pantry/edit/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Box, Typography, TextField, Button, Paper, CircularProgress, IconButton, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';

import { getItem, updateItem } from '../../../actions'; 

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const { data: session, status } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // DBから取得した元の画像URLを保持
  const [originalImageUrl, setOriginalImageUrl] = useState('');

  // 新しく選択された画像ファイルとプレビュー
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ★ 修正: daysLeft（残り日数）の手入力を廃止し、consumeDaysとconsumeAmountを追加
  const [formData, setFormData] = useState({
    name: '', 
    stock: '', 
    maxStock: '', 
    amazonUrl: '', 
    consumeDays: '1', 
    consumeAmount: '1',
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
            amazonUrl: item.amazonUrl || '',
            consumeDays: item.consumeDays.toString(),
            consumeAmount: item.consumeAmount.toString(),
          });
          
          if (item.imageUrl) {
            setOriginalImageUrl(item.imageUrl);
            setImagePreview(item.imageUrl);
          }
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview && imagePreview !== originalImageUrl) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let finalImageUrl = originalImageUrl;

      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', imageFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) throw new Error("画像のアップロードに失敗しました");
        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.url; 
      } else if (!imagePreview) {
        finalImageUrl = '';
      }

      // ★ 修正: 在庫と消費ペースから「残り日数（daysLeft）」を自動再計算する！
      const currentStock = parseInt(formData.stock, 10);
      const consumeDaysNum = parseInt(formData.consumeDays, 10);
      const consumeAmountNum = parseInt(formData.consumeAmount, 10);
      const calculatedDaysLeft = consumeAmountNum > 0 ? Math.floor((currentStock / consumeAmountNum) * consumeDaysNum) : 0;

      await updateItem(itemId, {
        name: formData.name,
        stock: currentStock,
        maxStock: parseInt(formData.maxStock, 10),
        daysLeft: calculatedDaysLeft, // 自動計算した日数を保存
        imageUrl: finalImageUrl,
        amazonUrl: formData.amazonUrl,
        consumeDays: consumeDaysNum,
        consumeAmount: consumeAmountNum,
      });
      
      router.push('/pantry');
    } catch (error) {
      console.error("更新に失敗しました:", error);
      alert("更新に失敗しました。");
    } finally {
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
    '& .MuiOutlinedInput-root': { borderRadius: '16px', backgroundColor: '#ffffff' }
  };
  const adornmentSx = { ml: 1, color: '#64748b', whiteSpace: 'nowrap', minWidth: 'fit-content' };

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
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 2, width: '100%', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ImageIcon fontSize="small" /> 商品の画像
              </Typography>
              
              {imagePreview ? (
                <Box sx={{ position: 'relative', width: { xs: 200, sm: 260 }, height: { xs: 200, sm: 260 }, borderRadius: '24px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <IconButton 
                    onClick={handleClearImage}
                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  component="label"
                  sx={{
                    width: '100%', maxWidth: { xs: 200, sm: 260 }, height: { xs: 200, sm: 260 }, border: '2px dashed #cbd5e1', borderRadius: '24px',
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

            <Divider sx={{ borderColor: '#e2e8f0', my: 1 }} />

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
            </Box>

            {/* ★ 追加: 消費ペースの編集エリア */}
            <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 2, ml: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                消費のペース <span style={{ color: '#ef4444' }}>*</span>
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField 
                  name="consumeDays" type="number" value={formData.consumeDays} onChange={handleChange} required 
                  InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>日間で</Typography> }} 
                  sx={{ flex: 1, ...textFieldSx }} 
                />
                <TextField 
                  name="consumeAmount" type="number" value={formData.consumeAmount} onChange={handleChange} required 
                  InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>個使う</Typography> }} 
                  sx={{ flex: 1, ...textFieldSx }} 
                />
              </Box>
            </Box>

            <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', mt: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 2 }}>商品情報（任意）</Typography>
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
              sx={{ mt: 2, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '24px' }}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : '情報を更新する'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}