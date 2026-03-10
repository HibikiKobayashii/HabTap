// src/app/pantry/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, CircularProgress, IconButton, Avatar, Chip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Tooltip, Snackbar, Alert, AlertColor,
  Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KitchenIcon from '@mui/icons-material/Kitchen';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RemoveIcon from '@mui/icons-material/Remove';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AutorenewIcon from '@mui/icons-material/Autorenew'; 
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; 
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; 
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { getUserItems, deleteItem, consumeItem } from '../actions';

type Item = {
  id: string;
  name: string;
  stock: number;
  maxStock: number;
  daysLeft: number;
  imageUrl: string | null;
};

export default function PantryManagementPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as AlertColor });
  const showMessage = (msg: string, sev: AlertColor = 'info') => setSnackbar({ open: true, message: msg, severity: sev });
  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  // 各種確認ダイアログの状態管理
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);

  const [consumeDialogOpen, setConsumeDialogOpen] = useState(false);
  const [itemToConsume, setItemToConsume] = useState<{ id: string, name: string } | null>(null);

  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [itemToRestock, setItemToRestock] = useState<{ id: string, name: string } | null>(null);

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  // スマホ用三点メニューの状態管理
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenuItem, setActiveMenuItem] = useState<{ id: string, name: string, stock: number } | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: Item) => {
    setAnchorEl(event.currentTarget);
    setActiveMenuItem({ id: item.id, name: item.name, stock: item.stock });
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    setActiveMenuItem(null);
  };

  const onMenuConsume = () => {
    if (activeMenuItem) handleConsumeClick(activeMenuItem.id, activeMenuItem.name);
    handleMenuClose();
  };
  const onMenuRestock = () => {
    if (activeMenuItem) handleRestockClick(activeMenuItem.id, activeMenuItem.name);
    handleMenuClose();
  };
  const onMenuEdit = () => {
    if (activeMenuItem) router.push(`/pantry/edit/${activeMenuItem.id}`);
    handleMenuClose();
  };
  const onMenuDelete = () => {
    if (activeMenuItem) handleDeleteClick(activeMenuItem.id, activeMenuItem.name);
    handleMenuClose();
  };

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isTestingCron, setIsTestingCron] = useState(false);

  // データの読み込み
  const fetchInventory = async () => {
    const userId = (session?.user as any)?.id;
    if (userId) {
      const inventory = await getUserItems(userId);
      setItems(inventory as Item[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchInventory();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [session, status]);

  // 消費（マイナス）の処理
  const handleConsumeClick = (itemId: string, itemName: string) => {
    setItemToConsume({ id: itemId, name: itemName });
    setConsumeDialogOpen(true);
  };
  const handleCancelConsume = () => {
    setConsumeDialogOpen(false);
    setItemToConsume(null);
  };
  const handleConfirmConsume = async () => {
    if (!itemToConsume) return;
    const { id, name } = itemToConsume;
    setConsumeDialogOpen(false);
    setItemToConsume(null);
    setProcessingId(id);
    
    try {
      const result = await consumeItem(id);
      if (result.error) showMessage(result.error, 'error');
      else if (result.item) {
        setItems(prevItems => prevItems.map(item => item.id === id ? { ...item, stock: result.item!.stock, daysLeft: result.item!.daysLeft } : item));
        showMessage(`「${name}」を1つ消費しました`, 'success');
      }
    } catch (error) { showMessage('消費処理に失敗しました。', 'error'); } finally { setProcessingId(null); }
  };

  // 補充（リセット）の処理
  const handleRestockClick = (itemId: string, itemName: string) => {
    setItemToRestock({ id: itemId, name: itemName });
    setRestockDialogOpen(true);
  };
  const handleCancelRestock = () => {
    setRestockDialogOpen(false);
    setItemToRestock(null);
  };
  const handleConfirmRestock = async () => {
    if (!itemToRestock) return;
    const { id, name } = itemToRestock;
    setRestockDialogOpen(false);
    setItemToRestock(null);
    setProcessingId(id);

    try {
      const res = await fetch('/api/items/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id })
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchInventory();
        showMessage(`「${name}」を満タンに補充しました`, 'success');

        if (data.isUpgraded) {
          await update(); 
          setUpgradeDialogOpen(true);
        }
      } else {
        showMessage(data.error || '補充に失敗しました', 'error');
      }
    } catch (error) {
      showMessage('補充処理に失敗しました。', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // 削除の処理
  const handleDeleteClick = (itemId: string, itemName: string) => {
    setItemToDelete({ id: itemId, name: itemName });
    setDeleteDialogOpen(true);
  };
  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteItem(itemToDelete.id);
      setItems(prevItems => prevItems.filter(item => item.id !== itemToDelete.id));
      showMessage('削除しました', 'success');
    } catch (error) { showMessage('削除に失敗しました。もう一度お試しください。', 'error'); } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // 管理者専用手動巡回テスト
  const handleTestCron = async () => {
    setIsTestingCron(true);
    try {
      const res = await fetch('/api/cron/check-stock', { headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'test_secret_for_local'}` } });
      const data = await res.json();
      if (res.ok) showMessage(`巡回完了：${data.results?.sentCount || 0}件の通知を送信しました`, 'success');
      else showMessage(data.error || '巡回テストに失敗しました', 'error');
    } catch (error) { showMessage('ネットワークエラー：巡回テストに失敗しました', 'error'); } finally { setIsTestingCron(false); }
  };

  if (status === 'loading' || loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;

  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 900, mx: 'auto', pb: 12 }}>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <KitchenIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: '-0.02em', fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>
              パントリー管理
            </Typography>
          </Box>

          {isAdmin && (
            <Box>
              <Tooltip title="深夜の巡回を今すぐ実行し、通知のテストを行います" placement="left">
                <Button 
                  variant="outlined" color="secondary" size="small" onClick={handleTestCron} disabled={isTestingCron} 
                  startIcon={isTestingCron ? <CircularProgress size={16} color="inherit" /> : <NotificationsActiveIcon />} 
                  sx={{ display: { xs: 'none', sm: 'flex' }, borderRadius: '24px', fontWeight: 'bold', textTransform: 'none', bgcolor: '#ffffff', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  手動巡回
                </Button>
              </Tooltip>

              <Tooltip title="手動巡回" placement="left">
                <IconButton 
                  color="secondary" onClick={handleTestCron} disabled={isTestingCron} 
                  sx={{ display: { xs: 'flex', sm: 'none' }, bgcolor: '#ffffff', border: '1px solid #e2e8f0', '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  {isTestingCron ? <CircularProgress size={20} color="inherit" /> : <NotificationsActiveIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {items.length === 0 ? (
          <Paper elevation={0} sx={{ p: 5, borderRadius: '32px', border: '1px dashed #cbd5e1', textAlign: 'center', bgcolor: 'transparent' }}>
            <Typography variant="body1" color="text.secondary">パントリーは空っぽです。下部のナビゲーションから仕入れを行いましょう。</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item) => (
              <Paper 
                key={item.id} 
                elevation={0} 
                sx={{ 
                  display: 'flex', alignItems: 'center', p: { xs: 2, sm: 3 }, borderRadius: '32px', border: '1px solid #e2e8f0', 
                  boxShadow: '0 4px 16px rgba(0,0,0,0.02)', transition: 'box-shadow 0.2s', 
                  '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.06)' } 
                }}
              >
                <Avatar src={item.imageUrl || ''} variant="rounded" sx={{ width: { xs: 56, sm: 64 }, height: { xs: 56, sm: 64 }, mr: { xs: 2, sm: 3 }, borderRadius: '16px', bgcolor: '#f8fafc' }}>
                  {!item.imageUrl && <KitchenIcon sx={{ color: '#cbd5e1' }} />}
                </Avatar>
                
                {/* ★ 修正：名前を省略せず、複数行に美しく折り返すように変更 */}
                <Box sx={{ flexGrow: 1, minWidth: 0, py: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.1rem' }, mb: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {item.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: '500' }}>在庫: <strong style={{ color: item.stock <= 0 ? '#ef4444' : '#0f172a' }}>{item.stock}</strong> / {item.maxStock}</Typography>
                    {/* ★ 修正：「約」を取り除き、断定的な表現にしました */}
                    <Chip label={`${item.daysLeft} 日分`} size="small" sx={{ bgcolor: item.daysLeft <= 2 ? '#fee2e2' : '#f1f5f9', color: item.daysLeft <= 2 ? '#b91c1c' : '#475569', fontWeight: 'bold', borderRadius: '12px' }} />
                  </Box>
                </Box>

                {/* PC用（横並びの4ボタン） */}
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, ml: 1 }}>
                  <Tooltip title="在庫を1つ消費する" placement="top">
                    <span>
                      <IconButton color="warning" onClick={() => handleConsumeClick(item.id, item.name)} disabled={item.stock <= 0 || processingId === item.id} sx={{ bgcolor: '#fffbeb', '&:hover': { bgcolor: '#fef3c7' } }}>
                        {processingId === item.id ? <CircularProgress size={20} color="warning" /> : <RemoveIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="在庫を満タンにする" placement="top">
                    <span>
                      <IconButton color="success" onClick={() => handleRestockClick(item.id, item.name)} disabled={processingId === item.id} sx={{ bgcolor: '#f0fdf4', color: '#166534', '&:hover': { bgcolor: '#dcfce7' } }}>
                        {processingId === item.id ? <CircularProgress size={20} color="success" /> : <AutorenewIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <IconButton color="primary" onClick={() => router.push(`/pantry/edit/${item.id}`)} sx={{ bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton color="error" onClick={() => handleDeleteClick(item.id, item.name)} sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </Box>

                {/* スマホ用（三点メニューボタン） */}
                <Box sx={{ display: { xs: 'flex', sm: 'none' }, ml: 1 }}>
                  <IconButton onClick={(e) => handleMenuOpen(e, item)} sx={{ color: '#64748b' }}>
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 8px 24px rgba(59, 130, 246, 0.15))',
              mt: 1.5,
              borderRadius: '20px',
              minWidth: '180px',
              border: '2.5px solid #3b82f6',
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={onMenuConsume} disabled={activeMenuItem?.stock === 0} sx={{ py: 1.5 }}>
            <ListItemIcon><RemoveIcon color="warning" fontSize="small" /></ListItemIcon>
            <ListItemText primary="1つ消費" primaryTypographyProps={{ fontWeight: 'bold', color: '#0f172a' }} />
          </MenuItem>
          <MenuItem onClick={onMenuRestock} sx={{ py: 1.5 }}>
            <ListItemIcon><AutorenewIcon color="success" fontSize="small" /></ListItemIcon>
            <ListItemText primary="満タンにする" primaryTypographyProps={{ fontWeight: 'bold', color: '#0f172a' }} />
          </MenuItem>
          <MenuItem onClick={onMenuEdit} sx={{ py: 1.5 }}>
            <ListItemIcon><EditIcon color="primary" fontSize="small" /></ListItemIcon>
            <ListItemText primary="編集" primaryTypographyProps={{ fontWeight: 'bold', color: '#0f172a' }} />
          </MenuItem>
          <MenuItem onClick={onMenuDelete} sx={{ py: 1.5 }}>
            <ListItemIcon><DeleteOutlineIcon color="error" fontSize="small" /></ListItemIcon>
            <ListItemText primary="削除" primaryTypographyProps={{ fontWeight: 'bold', color: 'error.main' }} />
          </MenuItem>
        </Menu>


        {/* 各種ダイアログの盛り付け */}
        <Dialog open={consumeDialogOpen} onClose={handleCancelConsume} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><InfoOutlinedIcon color="warning" />消費の確認</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{itemToConsume?.name}</strong>」の在庫を1つ消費しますか？<br /><Typography component="span" variant="body2" color="text.secondary">※予言（残り日数）も即座に再計算されます。</Typography></DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={handleCancelConsume} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
            <Button onClick={handleConfirmConsume} variant="contained" color="warning" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3, color: '#fff' }}>消費する</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={restockDialogOpen} onClose={handleCancelRestock} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><CheckCircleOutlineIcon color="success" />補充の確認</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{itemToRestock?.name}</strong>」をパントリーに満タン補充しますか？<br /><Typography component="span" variant="body2" color="text.secondary">※時間は今日の0:00として記録されます。</Typography></DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={handleCancelRestock} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
            <Button onClick={handleConfirmRestock} variant="contained" color="success" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3, color: '#fff' }}>満タンにする</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteDialogOpen} onClose={handleCancelDelete} PaperProps={{ sx: { borderRadius: '32px', p: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } }}>
          <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}><WarningAmberIcon color="error" />削除の確認</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'text.primary', lineHeight: 1.8 }}>「<strong>{itemToDelete?.name}</strong>」をパントリーから完全に削除してもよろしいですか？<br /><Typography component="span" variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>※この操作は取り消せません。</Typography></DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={handleCancelDelete} sx={{ fontWeight: 'bold', color: 'text.secondary', borderRadius: '24px', px: 3 }}>キャンセル</Button>
            <Button onClick={handleConfirmDelete} variant="contained" color="error" sx={{ fontWeight: 'bold', borderRadius: '24px', px: 3 }}>削除する</Button>
          </DialogActions>
        </Dialog>

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

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}