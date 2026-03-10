// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, CircularProgress, Divider,
  Snackbar, Alert, AlertColor 
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { signIn, useSession } from 'next-auth/react'; 
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  // ★ 独自アラート（Snackbar）の状態管理という、三ツ星のエッセンス
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
    setMounted(true); 
    const email = localStorage.getItem('biometric_email');
    if (email) {
      setSavedEmail(email);
    }
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleBiometricLogin = async () => {
    if (!savedEmail) return;
    setIsAuthenticating(true);

    try {
      const optRes = await fetch('/api/webauthn/authenticate/options', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedEmail }) 
      });
      const options = await optRes.json();
      if (options.error) throw new Error(options.error);

      let asseResp;
      try {
        asseResp = await startAuthentication(options);
      } catch (err: any) {
        // キャンセル時は静かに、しかし上品にお伝えします
        throw new Error('顔の読み取りがキャンセルされました。');
      }

      const result = await signIn('webauthn', {
        email: savedEmail,
        response: JSON.stringify(asseResp),
        host: window.location.host, 
        redirect: false, 
      });

      if (result?.error) {
        throw new Error('生体認証の審査に通りませんでした。');
      }

      router.push('/');

    } catch (error: any) {
      console.error(error);
      // ★ alertを捨て、Snackbarでスマートにおもてなし
      showMessage(error.message || '認証に失敗しました。', 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!mounted) return null;

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)' }}>
        <CircularProgress sx={{ color: '#4285F4' }} />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)' 
      }}>
        <Card sx={{ 
          maxWidth: 400, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', borderRadius: '32px', p: 2 
        }}>
          <CardContent sx={{ textAlign: 'center' }}>
            
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>HabiTap</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>消耗品管理パントリー</Typography>

            {savedEmail && (
              <Box sx={{ mb: 3 }}>
                <Button 
                  fullWidth variant="contained" size="large"
                  startIcon={isAuthenticating ? <CircularProgress size={20} color="inherit" /> : <FingerprintIcon />}
                  onClick={handleBiometricLogin} disabled={isAuthenticating}
                  sx={{ 
                    py: 1.5, borderRadius: '24px', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.3)', '&:hover': { backgroundColor: '#1e293b' }
                  }}
                >
                  {isAuthenticating ? '認証中...' : '顔パス（生体認証）で入場'}
                </Button>
                <Divider sx={{ my: 3, color: 'text.secondary', fontSize: '0.85rem' }}>または</Divider>
              </Box>
            )}

            <Button 
              fullWidth variant={savedEmail ? "outlined" : "contained"} size="large" startIcon={<GoogleIcon />}
              onClick={() => signIn('google', { callbackUrl: '/' })}
              sx={{ 
                py: 1.2, borderRadius: '24px', fontWeight: 'bold', 
                ...(savedEmail ? {
                  borderColor: '#e2e8f0', color: '#475569', '&:hover': { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }
                } : {
                  backgroundColor: '#4285F4', color: '#ffffff', boxShadow: '0 4px 10px rgba(66, 133, 244, 0.3)',
                  '&:hover': { backgroundColor: '#3367D6', boxShadow: '0 6px 14px rgba(66, 133, 244, 0.4)' }
                })
              }}
            >
              Googleでログイン
            </Button>

          </CardContent>
        </Card>
      </Box>

      {/* ★ 玄関に置かれた、気品ある案内プレート */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled" 
          sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}