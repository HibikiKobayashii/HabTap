// src/app/stock-in/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, TextField, Button, Paper, CircularProgress, Avatar, Divider, IconButton, Switch, Dialog, DialogContent
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

import { createItem, getUserPlanAndItemCount } from '../actions';

export default function StockInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);

  // ★ 追加：新しく仕入れた商品のIDを保持する（成功画面へ切り替えるためのフラグ）
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', stock: '', maxStock: '', consumeDays: '1', consumeAmount: '1', amazonUrl: '', isAutoConsume: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ★ 追加：NFC書き込みポップアップ専用の状態管理
  const [nfcDialogOpen, setNfcDialogOpen] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'scanning' | 'success' | 'error'>('scanning');
  const [nfcMessage, setNfcMessage] = useState('');
  const nfcAbortController = useRef<AbortController | null>(null);

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

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
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

    if (!imageFile) {
      return alert("商品の画像をアップロードしてください。");
    }

    setLoading(true);
    try {
      let uploadedImageUrl = '';
      const uploadFormData = new FormData();
      uploadFormData.append('file', imageFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) throw new Error("画像のアップロードに失敗しました");
      const uploadData = await uploadRes.json();
      uploadedImageUrl = uploadData.url; 

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
        imageUrl: uploadedImageUrl, 
        amazonUrl: formData.amazonUrl,
        isAutoConsume: formData.isAutoConsume, 
      });

      if (result?.error) {
        alert(result.error);
        if (result.error.includes('上限')) setIsLimitReached(true);
        return;
      }

      // ★ 修正：パントリーに飛ばさず、成功画面へ移行するためにIDをセット
      if (result?.item?.id) {
        setCreatedItemId(result.item.id);
      } else {
        router.push('/pantry'); // 万が一IDが取れなかったらパントリーへ
      }
    } catch (error) {
      console.error(error);
      alert("仕入れに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ★ 追加：NFCの待機を安全にキャンセルする関数
  const handleCancelNfc = () => {
    if (nfcAbortController.current) {
      nfcAbortController.current.abort();
    }
    setNfcDialogOpen(false);
  };

  // ★ 追加：NFC書き込みロジック（オーナーの気付きにより、自動消費は勝手にOFFにしません！）
  const handleNfcWrite = async () => {
    if (!('NDEFReader' in window)) {
      alert('お使いのブラウザや端末（iPhone等）は、WebからのNFC書き込みに対応しておりません。');
      return;
    }

    setNfcDialogOpen(true);
    setNfcStatus('scanning');
    setNfcMessage('NFCタグに情報を書き込みます。スマホをシールにしっかりと近づけてください...');

    const abortController = new AbortController();
    nfcAbortController.current = abortController;

    try {
      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.write(
        {
          records: [{
            recordType: "url",
            data: `${window.location.origin}/pantry/nfc/${createdItemId}`
          }]
        },
        { signal: abortController.signal }
      );

      setNfcStatus('success');
      setNfcMessage('NFCタグへの書き込みが正常に完了しました！次回からかざすだけで消費できます。');
      
      // ※オーナーの素晴らしい気付きにより、ここでは isAutoConsume をいじりません！
      // 自動でも手動(NFC)でも減らしたいお客様のために、設定を尊重します。

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("NFCスキャンがキャンセルされました。");
        return;
      }
      console.error("NFC Write Error:", error);
      setNfcStatus('error');
      setNfcMessage('書き込みに失敗しました。スマホのNFC位置を確認し、もう一度シールに近づけてください。');
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

      ) : createdItemId ? (
        // ==========================================
        // ★ 新設：仕入れ成功 ＆ NFC書き込みサジェスト画面
        // ==========================================
        <Paper elevation={0} sx={{ p: { xs: 4, md: 6 }, borderRadius: '32px', border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.03)', animation: 'fadeIn 0.5s ease-out' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: '#10b981', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 1 }}>
            仕入れが完了しました！
          </Typography>
          <Typography variant="body1" sx={{ color: '#475569', mb: 4 }}>
            「{formData.name}」がパントリーに追加されました。
          </Typography>

          <Box sx={{ p: 3, borderRadius: '24px', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', mb: 4, maxWidth: 400, mx: 'auto' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 1 }}>
              📱 NFCタグに登録しますか？
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3, lineHeight: 1.6 }}>
              市販のNFCシールに情報を書き込むと、次回からスマホをかざすだけで消費を記録できるようになります。（※Android限定）
            </Typography>
            <Button 
              variant="outlined" 
              fullWidth
              onClick={handleNfcWrite}
              sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, borderColor: '#94a3b8', color: '#0f172a', bgcolor: '#ffffff' }}
            >
              NFCシールに情報を書き込む
            </Button>
          </Box>

          <Button 
            variant="contained" 
            size="large"
            onClick={() => router.push('/pantry')}
            sx={{ borderRadius: '24px', px: 6, py: 1.5, fontWeight: 'bold', boxShadow: 'none' }}
          >
            パントリーへ戻る
          </Button>
        </Paper>

      ) : (
        // ==========================================
        // 通常の新規登録フォーム
        // ==========================================
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              
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
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>現在の在庫数 <span style={{ color: '#ef4444' }}>*</span></Typography>
                  <TextField placeholder="例: 3" name="stock" type="number" value={formData.stock} onChange={handleChange} required fullWidth sx={textFieldSx} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#475569', mb: 1, ml: 0.5 }}>満タン時の数 <span style={{ color: '#ef4444' }}>*</span></Typography>
                  <TextField placeholder="例: 6" name="maxStock" type="number" value={formData.maxStock} onChange={handleChange} required fullWidth sx={textFieldSx} />
                </Box>
              </Box>

              <Box sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 2, ml: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>消費のペース <span style={{ color: '#ef4444' }}>*</span></Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField name="consumeDays" type="number" value={formData.consumeDays} onChange={handleChange} required InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>日間で</Typography> }} sx={{ flex: 1, ...textFieldSx }} />
                  <TextField name="consumeAmount" type="number" value={formData.consumeAmount} onChange={handleChange} required InputProps={{ endAdornment: <Typography variant="body2" sx={adornmentSx}>個使う</Typography> }} sx={{ flex: 1, ...textFieldSx }} />
                </Box>
              </Box>

              <Box 
                sx={{ 
                  p: 2.5, 
                  borderRadius: '24px', 
                  bgcolor: '#ffffff', 
                  border: '1px solid #e2e8f0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
                }}
              >
                <Box sx={{ pr: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                    日付が変わる時に在庫を自動で減らす（初期設定：ON）
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, lineHeight: 1.4 }}>
                    ※OFFにすると、毎晩の自動計算をスルーします。NFCタグのタッチや手動でのみ消費させたい商品に最適です。
                  </Typography>
                </Box>
                <Switch 
                  name="isAutoConsume"
                  checked={formData.isAutoConsume} 
                  onChange={handleSwitchChange} 
                  color="primary"
                />
              </Box>

              <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '24px' }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'パントリーに仕入れる'}
              </Button>
            </Box>
          </form>
        </Paper>
      )}

      {/* ==========================================
          ★ 新設：NFC書き込み中のダイアログ
          ========================================== */}
      <Dialog 
        open={nfcDialogOpen} 
        onClose={handleCancelNfc} 
        PaperProps={{ sx: { borderRadius: '28px', p: 2, maxWidth: 360, width: '100%', textAlign: 'center' } }}
      >
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, py: 3 }}>
          {nfcStatus === 'scanning' && (
            <>
              <CircularProgress size={56} thickness={4} sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a', mt: 1 }}>
                タグを近づけてください
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', px: 1, lineHeight: 1.5, mb: 1 }}>
                {nfcMessage}
              </Typography>
              <Button 
                variant="outlined" 
                onClick={handleCancelNfc}
                sx={{ borderRadius: '20px', fontWeight: 'bold', borderColor: '#cbd5e1', color: '#475569', mt: 1, px: 4 }}
              >
                キャンセル
              </Button>
            </>
          )}

          {nfcStatus === 'success' && (
            <>
              <CheckCircleIcon sx={{ fontSize: 64, color: '#10b981', animation: 'scaleUp 0.3s ease-out' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                書き込み完了！
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', px: 1, lineHeight: 1.5 }}>
                {nfcMessage}
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => setNfcDialogOpen(false)}
                sx={{ borderRadius: '20px', px: 4, mt: 1, fontWeight: 'bold', boxShadow: 'none' }}
              >
                閉じる
              </Button>
            </>
          )}

          {nfcStatus === 'error' && (
            <>
              <CancelIcon sx={{ fontSize: 64, color: '#ef4444' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                書き込み失敗
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', px: 1, lineHeight: 1.5 }}>
                {nfcMessage}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1, width: '100%' }}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={handleCancelNfc}
                  sx={{ borderRadius: '20px', fontWeight: 'bold', borderColor: '#cbd5e1', color: '#475569' }}
                >
                  キャンセル
                </Button>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={handleNfcWrite} 
                  sx={{ borderRadius: '20px', fontWeight: 'bold' }}
                >
                  再試行
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}