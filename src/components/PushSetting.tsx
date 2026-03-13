// src/components/PushSetting.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Switch, CircularProgress, 
  Snackbar, Alert, AlertColor, Button, Divider 
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import { useSession } from 'next-auth/react';
import { savePushSubscription } from '@/app/actions';

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
  const [syncing, setSyncing] = useState(false);

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
        showMessage('通知をオンにし、この端末＆アカウントをメインに設定しました', 'success');

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
      showMessage(
        isChecked ? '通知の許可が得られませんでした。' : '通知の解除に失敗しました。', 
        'error'
      );
      setIsSubscribed(!isChecked); 
    } finally {
      setLoading(false);
    }
  };

  const handleSetMainDevice = async () => {
    if (!session?.user) return;
    setSyncing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) throw new Error('VAPIDキーが見つかりません。');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        setIsSubscribed(true);
      }

      await savePushSubscription((session.user as any).id, JSON.stringify(subscription));
      showMessage('この端末＆アカウントをメインに設定しました', 'success');

    } catch (error) {
      console.error(error);
      showMessage('設定に失敗しました。', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: '24px', 
          border: '1px solid #e2e8f0', 
          p: { xs: 2.5, sm: 3 }, 
          bgcolor: '#ffffff', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)' 
        }}
      >
        {/* 上段：通知スイッチエリア */}
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

        {isSubscribed && (
          <>
            <Divider sx={{ my: 2.5, borderColor: '#f1f5f9' }} />
            {/* ★ 修正：flexDirection を 'column' に固定し、縦並びに統一 */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-start', // 左寄せで安定感を出す
              gap: 2.5 
            }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                  通知を受け取る端末＆アカウント
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.8, lineHeight: 1.6 }}>
                  ※複数の端末＆アカウントをお使いの場合、最後にボタンを押した端末＆アカウントにのみ通知が届きます。
                </Typography>
              </Box>
              
              <Button
                variant="outlined"
                color="primary"
                fullWidth // ★ 横幅いっぱいに広げることで、スマホでもPCでも押しやすいボタンに
                onClick={handleSetMainDevice}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={16} /> : <SmartphoneIcon />}
                sx={{ 
                  borderRadius: '16px', 
                  fontWeight: 'bold', 
                  py: 1.5,
                  textTransform: 'none', // 勝手に大文字にならないように
                  bgcolor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  '&:hover': { bgcolor: '#f1f5f9', border: '1px solid #94a3b8' }
                }}
              >
                この端末＆アカウントをメインにする
              </Button>
            </Box>
          </>
        )}
      </Paper>

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