// src/components/PushSetting.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Switch, CircularProgress, 
  Snackbar, Alert, AlertColor 
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useSession } from 'next-auth/react';
import { savePushSubscription } from '@/app/actions';

// VAPIDキーを翻訳する特殊な器具
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushSetting() {
  const { data: session } = useSession();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // ★ 独自アラート（Snackbar）の状態管理という隠し味
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
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(subscription !== null);
        });
      });
    }
  }, []);

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // ★ Chromeのダイアログはもう使いません。スッと洗練された警告を出します。
    if (!session?.user) {
      showMessage('ログインが必要です', 'warning');
      return;
    }
    
    const isChecked = event.target.checked;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isChecked) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) throw new Error('VAPIDキーが見つかりません。');

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        await savePushSubscription((session.user as any).id, JSON.stringify(subscription));
        setIsSubscribed(true);
        showMessage('通知をオンにしました', 'success');

      } else {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
        setIsSubscribed(false);
        showMessage('通知をオフにしました', 'info');
      }
    } catch (error) {
      console.error(error);
      // ★ 失敗の際も、上品にエラーをお伝えします
      showMessage(
        isChecked ? '通知の許可が得られませんでした。' : '通知の解除に失敗しました。', 
        'error'
      );
      setIsSubscribed(!isChecked); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: '24px', 
          border: '1px solid #e2e8f0', 
          p: 2.5, 
          bgcolor: '#ffffff', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)' 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationsActiveIcon color="primary" sx={{ fontSize: 28 }} />
            <Box>
              <Typography sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                在庫切れの事前通知
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.5 }}>
                在庫がなくなる2日前にプッシュ通知でお知らせします
              </Typography>
            </Box>
          </Box>
          {loading ? (
            <CircularProgress size={24} sx={{ mr: 1, color: 'primary.main' }} />
          ) : (
            <Switch 
              checked={isSubscribed} 
              onChange={handleToggle} 
              color="primary"
            />
          )}
        </Box>
      </Paper>

      {/* ★ お客様への極上のメッセージ・プレート（Snackbar） */}
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