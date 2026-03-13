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
  const [syncing, setSyncing] = useState(false); // ★ 追加：メイン端末切り替えボタン用のローディング

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

  // ★ 変更：スイッチは純粋に「このブラウザで通知を許可するか/解除するか」のみを担当します
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

        // 初回ON時は自動的にメイン端末として登録します
        await savePushSubscription((session.user as any).id, JSON.stringify(subscription));
        setIsSubscribed(true);
        showMessage('通知をオンにし、この端末をメインに設定しました', 'success');

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

  // ★ 新設：この端末を強制的に「メインの宛先」としてサーバーに上書きするボタン
  const handleSetMainDevice = async () => {
    if (!session?.user) return;
    setSyncing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // もし裏側で許可が外れていた場合は再取得
      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) throw new Error('VAPIDキーが見つかりません。');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        setIsSubscribed(true);
      }

      // 現在の端末の宛先（トークン）をデータベースに上書き
      await savePushSubscription((session.user as any).id, JSON.stringify(subscription));
      showMessage('この端末をメインの通知先に設定しました', 'success');

    } catch (error) {
      console.error(error);
      showMessage('端末の設定に失敗しました。', 'error');
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

        {/* ★ スイッチがON（許可状態）の時だけ、メイン端末変更ボタンを表示します */}
        {isSubscribed && (
          <>
            <Divider sx={{ my: 2.5, borderColor: '#f1f5f9' }} />
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                  通知を受け取る端末
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                  ※複数の端末をお使いの場合、<br />最後にボタンを押した端末にのみ通知が届きます。
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSetMainDevice}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={16} /> : <SmartphoneIcon />}
                sx={{ 
                  borderRadius: '20px', 
                  fontWeight: 'bold', 
                  px: 2.5,
                  py: 1,
                  whiteSpace: 'nowrap'
                }}
              >
                この端末をメインにする
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* お客様への極上のメッセージ・プレート */}
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