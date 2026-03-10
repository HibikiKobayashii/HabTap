'use client';
import { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemText, ListItemIcon, Switch, Paper, Divider } from '@mui/material';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

export default function SettingsPage() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // マウント時に現在の設定を読み込む
  useEffect(() => {
    const saved = localStorage.getItem('biometric_enabled') === 'true';
    setBiometricEnabled(saved);
  }, []);

  // スイッチを切り替えた時の処理
  const handleBiometricToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setBiometricEnabled(isChecked);
    localStorage.setItem('biometric_enabled', String(isChecked));
    
    // ※ 実際にONにした瞬間、端末に「指紋（顔）を登録しますか？」という処理を走らせます
    if (isChecked) {
      console.log('生体認証のデバイス登録プロセスを開始します...');
      // navigator.credentials.create(...) を呼び出す
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, pb: 12, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        設定
      </Typography>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <List disablePadding>
          
          {/* 生体認証のトグルスイッチ */}
          <ListItem sx={{ py: 2, px: 3 }}>
            <ListItemIcon>
              <FingerprintIcon color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText 
              primary={<Typography variant="subtitle1" fontWeight="bold">生体認証ログイン</Typography>} 
              secondary="アプリを開いた瞬間に、顔や指紋で自動ログインします" 
            />
            <Switch 
              edge="end" 
              color="primary"
              checked={biometricEnabled}
              onChange={handleBiometricToggle}
            />
          </ListItem>

          <Divider />

          {/* 今後の拡張用：通知設定など */}
          <ListItem sx={{ py: 2, px: 3 }}>
            <ListItemIcon>
              <NotificationsActiveIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
            </ListItemIcon>
            <ListItemText 
              primary={<Typography variant="subtitle1" fontWeight="bold">補充リマインダー</Typography>} 
              secondary="ストックが減った際に通知を受け取ります" 
            />
            <Switch edge="end" color="primary" defaultChecked />
          </ListItem>

        </List>
      </Paper>
    </Box>
  );
}