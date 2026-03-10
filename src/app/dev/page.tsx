// src/app/dev/page.tsx
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Avatar
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import BuildIcon from '@mui/icons-material/Build';

export default function DevPlaygroundPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 各種ダイアログの状態管理
  const [consumeDialogOpen, setConsumeDialogOpen] = useState(false);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  // ダミーの食材名
  const dummyItemName = "幻のカレーメシ";

  if (status === 'loading') {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  }

  // ★ 門番：Admin（管理者）以外はパントリーへ強制送還します
  const isAdmin = (session?.user as any)?.role === 'admin';
  if (status === 'unauthenticated' || !isAdmin) {
    if (typeof window !== 'undefined') router.push('/pantry');
    return null;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1.5 }}>
        <BuildIcon sx={{ fontSize: 32, color: '#475569' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', letterSpacing: '-0.02em' }}>
          開発者ルーム (Dev)
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
        <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.8 }}>
          ここはオーナー専用の試食室です。<br />
          実際のデータベース（在庫）には一切影響を与えずに、HabiTapに実装されているすべてのダイアログ（UI）の挙動を確認できます。
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button 
            variant="outlined" color="warning" size="large" onClick={() => setConsumeDialogOpen(true)}
            sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#fff' }}
          >
            【確認】 消費ダイアログを開く
          </Button>

          <Button 
            variant="outlined" color="success" size="large" onClick={() => setRestockDialogOpen(true)}
            sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#fff' }}
          >
            【確認】 補充（リセット）ダイアログを開く
          </Button>

          <Button 
            variant="outlined" color="error" size="large" onClick={() => setDeleteDialogOpen(true)}
            sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#fff' }}
          >
            【警告】 削除ダイアログを開く
          </Button>

          <Button 
            variant="contained" size="large" onClick={() => setUpgradeDialogOpen(true)}
            sx={{ borderRadius: '24px', fontWeight: 'bold', py: 1.5, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, mt: 2 }}
          >
            【祝祭】 VIP昇格ファンファーレを開く
          </Button>
        </Box>
      </Paper>

      {/* =========================================
          以下、パントリー画面と全く同じダイアログの盛り付け
          ========================================= */}

      {/* 1. 消費ダイアログ */}
      <Dialog open={consumeDialogOpen} onClose={() => setConsumeDialogOpen(false)} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><InfoOutlinedIcon color="warning" />消費の確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{dummyItemName}</strong>」の在庫を1つ消費しますか？<br /><Typography component="span" variant="body2" color="text.secondary">※予言（残り日数）も即座に再計算されます。</Typography></DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setConsumeDialogOpen(false)} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
          <Button onClick={() => setConsumeDialogOpen(false)} variant="contained" color="warning" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3, color: '#fff' }}>消費する</Button>
        </DialogActions>
      </Dialog>

      {/* 2. 補充ダイアログ */}
      <Dialog open={restockDialogOpen} onClose={() => setRestockDialogOpen(false)} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><CheckCircleOutlineIcon color="success" />補充の確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{dummyItemName}</strong>」をパントリーに満タン補充しますか？<br /><Typography component="span" variant="body2" color="text.secondary">※時間は今日の0:00として記録されます。</Typography></DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setRestockDialogOpen(false)} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
          <Button onClick={() => setRestockDialogOpen(false)} variant="contained" color="success" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3, color: '#fff' }}>満タンにする</Button>
        </DialogActions>
      </Dialog>

      {/* 3. 削除ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><WarningAmberIcon color="error" />削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{dummyItemName}</strong>」をパントリーから完全に削除してもよろしいですか？<br /><Typography component="span" variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>※この操作は取り消せません。</Typography></DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
          <Button onClick={() => setDeleteDialogOpen(false)} variant="contained" color="error" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3 }}>削除する</Button>
        </DialogActions>
      </Dialog>

      {/* 4. VIP昇格祝いのダイアログ */}
      <Dialog 
        open={upgradeDialogOpen} 
        onClose={() => setUpgradeDialogOpen(false)} 
        PaperProps={{ sx: { borderRadius: '32px', p: 2, boxShadow: '0 16px 48px rgba(0,0,0,0.12)', background: 'linear-gradient(145deg, #ffffff, #f8fafc)' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, pb: 1 }}>
          <Avatar sx={{ bgcolor: '#fbbf24', width: 72, height: 72, boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)' }}>
            <StarRoundedIcon sx={{ fontSize: 40, color: '#fff' }} />
          </Avatar>
        </Box>
        <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '1.4rem', color: '#0f172a' }}>
          VIP席へようこそ
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8, textAlign: 'center' }}>
            見事、パントリーの補充を<strong>2回</strong>達成いたしました。<br /><br />
            これより、あなたはHabiTapの熟練者（PRO）です。<br />
            <strong>4品目以降の仕入れ</strong>が可能となりました。さらなる快適な生活をお楽しみください。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => setUpgradeDialogOpen(false)} variant="contained" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 5, py: 1.5, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
            仕入れを続ける
          </Button>
        </DialogActions>
      </Dialog>
      
    </Box>
  );
}