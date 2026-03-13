// src/app/account/page.tsx
'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Avatar, Button, Chip, Divider, 
  List, ListItem, ListItemIcon, ListItemText, Switch, CircularProgress, TextField, Fade,
  Snackbar, Alert, AlertColor 
} from '@mui/material';
import { useRouter } from 'next/navigation';

import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import LogoutIcon from '@mui/icons-material/Logout';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

import PushSetting from '@/components/PushSetting';
import { submitFeedback, getBiometricStatus, removeBiometricStatus } from '@/app/actions';
import { startRegistration } from '@simplewebauthn/browser';

import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function AccountPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [biometric, setBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false); // ★ 通知テスト用のローディング状態
  
  const [clientSecret, setClientSecret] = useState('');
  const [isLocallyPro, setIsLocallyPro] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info' as AlertColor,
  });

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const showMessage = (msg: string, sev: AlertColor = 'info') => {
    setSnackbar({ open: true, message: msg, severity: sev });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (sessionId) {
      setIsLocallyPro(true);
      setClientSecret('');
      showMessage('PROプランへのアップグレードが完了しました！', 'success');
      update();
      window.history.replaceState(null, '', '/account');
    }
  }, [update]);

  useEffect(() => {
    const syncStatus = async () => {
      if (session?.user) {
        const isRegistered = await getBiometricStatus((session.user as any).id);
        setBiometric(isRegistered);
        
        if (isRegistered) {
          localStorage.setItem('biometric_email', session.user.email!);
        } else {
          localStorage.removeItem('biometric_email');
        }
      }
      setBiometricLoading(false);
    };

    if (status === 'authenticated') {
      syncStatus();
    }
  }, [session, status]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) return null;

  const isPro = (session.user as any)?.plan === 'pro' || isLocallyPro;
  const isAdmin = (session.user as any)?.role === 'admin';
  const adminPurple = '#8E24AA';

  // 【支配人専用】テスト通知の発射
  const handleTestNotification = async () => {
    setIsTestingPush(true);
    try {
      const res = await fetch('/api/admin/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (session.user as any).id })
      });
      const data = await res.json();
      
      if (data.error) {
        showMessage(data.error, 'error');
      } else {
        showMessage('テスト通知を送信しました。端末をご確認ください。', 'success');
      }
    } catch (error) {
      console.error(error);
      showMessage('通信エラーが発生しました。', 'error');
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleUpgradeToPro = async () => {
    if (!isAdmin) {
      showMessage('現在、一般公開に向けた準備中です。', 'warning');
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (session.user as any).id })
      });
      const data = await res.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        showMessage('決済画面の準備に失敗しました。', 'error');
      }
    } catch (error) {
      console.error(error);
      showMessage('通信エラーが発生しました。', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (session.user as any).id })
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        showMessage(data.error || 'ポータルの準備に失敗しました。一度ログアウトをお試しください。', 'error');
      }
    } catch (error) {
      console.error(error);
      showMessage('通信エラーが発生しました。', 'error');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleBiometricToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    if (!session?.user) {
      showMessage('ログインが必要です', 'warning');
      return;
    }

    setBiometricLoading(true);

    if (isChecked) {
      try {
        const optRes = await fetch('/api/webauthn/register/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: (session.user as any).id,
            email: session.user.email,
            name: session.user.name,
          }),
        });
        const options = await optRes.json();
        if (options.error) throw new Error(options.error);

        let attResp;
        try {
          attResp = await startRegistration(options);
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            throw new Error('顔の登録がキャンセルされました。');
          }
          throw new Error('生体認証に対応していないか、設定が必要です。');
        }

        const verifyRes = await fetch('/api/webauthn/register/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: (session.user as any).id,
            response: attResp,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setBiometric(true);
          localStorage.setItem('biometric_email', session.user.email!); 
          showMessage('生体認証を登録しました。次回から顔パスで入場可能です。', 'success');
        } else {
          throw new Error(verifyData.error || 'データの照合に失敗しました。');
        }
      } catch (error: any) {
        console.error(error);
        showMessage(error.message || '登録に失敗しました。', 'error');
        setBiometric(false);
      } finally {
        setBiometricLoading(false);
      }
    } else {
      try {
        const result = await removeBiometricStatus((session.user as any).id);
        if (result.success) {
          setBiometric(false);
          localStorage.removeItem('biometric_email');
          showMessage('生体認証を解除しました。', 'info');
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        console.error(error);
        showMessage('解除に失敗しました。もう一度お試しください。', 'error');
        setBiometric(true);
      } finally {
        setBiometricLoading(false);
      }
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedback.trim() || !session.user) return;
    
    setIsSubmitting(true);
    try {
      const result = await submitFeedback((session.user as any).id, feedback);
      if (result.error) {
        showMessage(result.error, 'error');
      } else {
        setIsSuccess(true);
        setFeedback(''); 
        setTimeout(() => setIsSuccess(false), 4000);
      }
    } catch (error) {
      console.error(error);
      showMessage("送信に失敗しました。通信環境をご確認ください。", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const linkButtonSx = { 
    justifyContent: 'space-between', 
    py: 2, 
    color: 'text.primary', 
    borderBottom: '1px solid #e2e8f0',
    borderRadius: 0,
    textTransform: 'none',
    '&:hover': { bgcolor: '#f8fafc' }
  };

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 600, mx: 'auto', pb: { xs: 14, md: 16 } }}>
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a' }}>Account</Typography>

        {/* ユーザー情報カード */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: '32px', border: '1px solid #e2e8f0', mb: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar src={session.user?.image || ''} sx={{ width: 64, height: 64 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{session.user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">{session.user?.email}</Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
            <Typography sx={{ fontWeight: '500' }}>プラン</Typography>
            <Chip label={isPro ? "PRO 会員" : "無料プラン"} variant={isPro ? "filled" : "outlined"} sx={isPro ? { bgcolor: '#D4AF37', color: '#fff', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)' } : { color: 'primary.main', borderColor: 'primary.main', fontWeight: 'bold' }} />
          </Box>
          {isAdmin && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                <Typography sx={{ fontWeight: '500' }}>権限</Typography>
                <Chip label="支配人 (Admin)" size="small" sx={{ bgcolor: adminPurple, color: '#fff', fontWeight: 'bold' }} />
              </Box>
              {/* ★ 管理者専用：通知テストボタン */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, mt: 1, borderTop: '1px dashed #e2e8f0' }}>
                <Typography sx={{ fontWeight: '500', fontSize: '0.9rem', color: 'text.secondary' }}>通知テスト</Typography>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={handleTestNotification}
                  disabled={isTestingPush}
                  startIcon={isTestingPush ? <CircularProgress size={14} color="inherit" /> : <NotificationsActiveIcon sx={{fontSize: 16}} />}
                  sx={{ borderRadius: '16px', textTransform: 'none', color: adminPurple, borderColor: adminPurple, '&:hover': { bgcolor: '#f3e5f5' } }}
                >
                  歓迎通知を発射
                </Button>
              </Box>
            </>
          )}
        </Paper>

        {/* PRO会員向け：契約管理（カスタマーポータル）への扉 */}
        {isPro && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: '32px', border: '1px solid #D4AF37', bgcolor: '#fffdf4', mb: 4, textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <WorkspacePremiumIcon sx={{ color: '#D4AF37' }} /> PROプランご利用中
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mb: 2, lineHeight: 1.6 }}>
              現在、パントリー管理を無制限でご利用いただけます。<br />お支払い方法の変更やご解約は下記よりお手続きください。
            </Typography>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={handleManageSubscription} 
              disabled={portalLoading}
              startIcon={portalLoading ? <CircularProgress size={20} color="inherit" /> : <OpenInNewIcon />}
              sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, borderColor: '#D4AF37', color: '#D4AF37', '&:hover': { bgcolor: '#fff9e6', borderColor: '#b5952f' } }}
            >
              {portalLoading ? 'ページを準備中...' : '契約内容の確認・解約'}
            </Button>
          </Paper>
        )}

        {/* 非PRO会員向け：アップグレード導線 */}
        {!isPro && !clientSecret && (
          isAdmin ? (
            <Paper elevation={0} sx={{ p: 3, borderRadius: '32px', border: '1px solid #D4AF37', bgcolor: '#fffdf4', mb: 4, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <WorkspacePremiumIcon sx={{ color: '#D4AF37' }} /> 【Admin専用】PROプランへアップグレード
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', mb: 2, lineHeight: 1.6 }}>
                月額100円で、4品目以上のパントリー管理が無制限に可能になります。
              </Typography>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={handleUpgradeToPro} 
                disabled={checkoutLoading}
                startIcon={checkoutLoading ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#D4AF37', '&:hover': { bgcolor: '#b5952f' }, color: '#fff' }}
              >
                {checkoutLoading ? '準備中...' : 'PRO版にアップグレードする'}
              </Button>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ p: 3, borderRadius: '32px', border: '1px solid #e2e8f0', bgcolor: '#f8fafc', mb: 4, textAlign: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#94a3b8', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <WorkspacePremiumIcon sx={{ color: '#94a3b8' }} /> PROプラン（準備中）
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2, lineHeight: 1.6 }}>
                現在、決済システムの最終調整を行っております。<br />公開まで今しばらくお待ちください。
              </Typography>
              <Button 
                variant="contained" 
                fullWidth 
                disabled={true} 
                sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#e2e8f0', color: '#94a3b8' }}
              >
                現在ご利用いただけません
              </Button>
            </Paper>
          )
        )}

        {clientSecret && (
          <Paper elevation={0} sx={{ mb: 4, p: { xs: 2, md: 3 }, borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">決済手続き</Typography>
              <Button size="small" onClick={() => setClientSecret('')} sx={{ color: 'text.secondary', borderRadius: '16px' }}>
                キャンセル
              </Button>
            </Box>
            <Box sx={{ width: '100%', minHeight: '400px' }}>
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{clientSecret}}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </Box>
          </Paper>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 1, fontWeight: 'bold' }}>APP SETTINGS</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
          <PushSetting />
          <Paper elevation={0} sx={{ borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', bgcolor: '#ffffff' }}>
            <List disablePadding>
              <ListItem sx={{ p: { xs: 2.5, md: 3 } }}>
                <ListItemIcon sx={{ minWidth: 48 }}><FingerprintIcon color="primary" sx={{ fontSize: 28 }} /></ListItemIcon>
                <ListItemText disableTypography primary={<Typography sx={{ fontWeight: 'bold', color: '#0f172a' }}>生体認証ログイン</Typography>} secondary={<Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>顔や指紋でスムーズにホームへ</Typography>} />
                {biometricLoading ? <CircularProgress size={24} sx={{ mr: 1, color: 'primary.main' }} /> : <Switch edge="end" checked={biometric} onChange={handleBiometricToggle} color="primary" />}
              </ListItem>
            </List>
          </Paper>
        </Box>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 1, fontWeight: 'bold' }}>VOIX (お客様の声)</Typography>
        <Paper elevation={0} sx={{ p: 3, borderRadius: '32px', border: '1px solid #e2e8f0', mb: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>HabiTapへのご要望を管理人へお届けください。</Typography>
          <TextField multiline rows={3} fullWidth placeholder="例：定期購入しているサプリも管理したいです" value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={isSuccess} sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '16px', bgcolor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } }} />
          <Box sx={{ minHeight: '48px', position: 'relative' }}>
            {isSuccess ? (
              <Fade in={isSuccess} timeout={500}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1.5, borderRadius: '24px', bgcolor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 'bold' }}>
                  <CheckCircleIcon />貴重な声をありがとうございました。
                </Box>
              </Fade>
            ) : (
              <Fade in={!isSuccess} timeout={500}>
                <Button variant="contained" fullWidth onClick={handleFeedbackSubmit} disabled={!feedback.trim() || isSubmitting} startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />} sx={{ borderRadius: '24px', py: 1.5, fontWeight: 'bold', fontSize: '1rem', boxShadow: feedback.trim() ? '0 4px 14px rgba(25, 118, 210, 0.3)' : 'none' }}>
                  {isSubmitting ? '送信中...' : '声を届ける'}
                </Button>
              </Fade>
            )}
          </Box>
        </Paper>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 1, fontWeight: 'bold' }}>LEGAL & INFO</Typography>
        <Box sx={{ mb: 4 }}>
          <Button fullWidth onClick={() => router.push('/about')} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 14 }} />} sx={linkButtonSx}>About HabiTap</Button>
          <Button fullWidth onClick={() => router.push('/terms')} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 14 }} />} sx={linkButtonSx}>利用規約</Button>
          <Button fullWidth onClick={() => router.push('/privacy')} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 14 }} />} sx={linkButtonSx}>プライバシーポリシー</Button>
          <Button fullWidth onClick={() => router.push('/tokushoho')} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 14 }} />} sx={{ ...linkButtonSx, borderBottom: 'none' }}>特定商取引法に基づく表記</Button>
        </Box>

        <Button fullWidth onClick={() => signOut({ callbackUrl: '/' })} startIcon={<LogoutIcon />} sx={{ py: 1.5, color: 'error.main', fontWeight: 'bold', backgroundColor: '#fef2f2', borderRadius: '24px', '&:hover': { backgroundColor: '#fee2e2' } }}>ログアウト</Button>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
}