// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, CircularProgress, Card, CardContent, 
  LinearProgress, Button, Divider, IconButton, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Avatar, Chip, Menu, MenuItem
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import InventoryIcon from '@mui/icons-material/Inventory';
import SecurityIcon from '@mui/icons-material/Security';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAdminStats, getAdminChartData, getAllUsers, updateUserRolePlan } from '../actions';

type AdminStats = {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalItems: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]); 
  const [users, setUsers] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<{ id: string, field: 'role' | 'plan' } | null>(null);

  const [yScaleIndex, setYScaleIndex] = useState(0); 
  const [xScaleIndex, setXScaleIndex] = useState(2); 

  const ySteps = [1, 5, 10];
  const xScales = ['day', 'week', 'month'] as const;
  const xScaleLabels = ['1日', '1週間', '1ヶ月'];

  const currentYStep = ySteps[yScaleIndex];
  const currentXScale = xScales[xScaleIndex];
  const currentXLabel = xScaleLabels[xScaleIndex];

  const isAdmin = (session?.user as any)?.role === 'admin';

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) {
      router.push('/');
      return;
    }

    if (status === 'authenticated' && isAdmin) {
      setChartLoading(true);
      Promise.all([
        getAdminStats(),
        getAdminChartData(currentXScale),
        getAllUsers()
      ])
        .then(([statsData, chart, usersData]) => {
          setStats(statsData);
          setChartData(chart);
          setUsers(usersData);
          setPageLoading(false);
          setChartLoading(false);
        }).catch((err) => {
          console.error("データの抽出に失敗しました:", err);
          setPageLoading(false);
          setChartLoading(false);
        });
    }
  }, [session, status, isAdmin, router, currentXScale]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, userId: string, field: 'role' | 'plan') => {
    setAnchorEl(event.currentTarget);
    setMenuTarget({ id: userId, field });
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleSelectUpdate = async (value: string) => {
    if (!menuTarget) return;
    const { id, field } = menuTarget;
    
    const res = await updateUserRolePlan(id, { [field]: value });
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
    } else {
      alert(res.error);
    }
    handleCloseMenu();
  };

  if (status === 'loading' || pageLoading || !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const proPercentage = stats.totalUsers > 0 ? (stats.proUsers / stats.totalUsers) * 100 : 0;

  const maxDataValue = Math.max(
    ...chartData.map(d => Math.max(d.ユーザー総数 || 0, d.アクティブユーザー || 0)),
    0
  );
  const maxTick = Math.ceil(maxDataValue / currentYStep) * currentYStep;
  const yTicks = [];
  for (let i = 0; i <= Math.max(maxTick, currentYStep); i += currentYStep) {
    yTicks.push(i);
  }

  const controlBaseSx = {
    position: 'absolute', zIndex: 10, display: 'flex', alignItems: 'center',
    bgcolor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
    borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', backdropFilter: 'blur(4px)'
  };

  const getColorStyle = (type: string) => {
    switch (type) {
      case 'pro': return { bg: '#ffffff', text: '#D4AF37', border: '#D4AF37' };
      case 'free': return { bg: '#ffffff', text: '#1976d2', border: '#1976d2' };
      case 'admin': return { bg: '#ffffff', text: '#8E24AA', border: '#8E24AA' };
      default: return { bg: '#ffffff', text: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 1000, mx: 'auto', pb: 12 }}>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1.5 }}>
        <SecurityIcon sx={{ fontSize: 32, color: '#8E24AA' }} />
        <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 'bold', letterSpacing: '-0.02em', fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          管理者ダッシュボード
        </Typography>
      </Box>

      {/* 1. グラフセクション（一番上に移動） */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, pb: { xs: 13, md: 6 }, borderRadius: '32px', border: '1px solid #e2e8f0', mb: 4 }}>
        <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 'bold', mb: 1 }}>アクティブユーザー推移</Typography>
        <Box sx={{ position: 'relative', width: '100%', height: 400, pt: { xs: 2, sm: 0 } }}>
          {chartLoading && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, bgcolor: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <CircularProgress size={40} />
            </Box>
          )}
          <Box sx={{ ...controlBaseSx, top: { xs: -35, sm: 20 }, left: { xs: 0, sm: -15 }, py: 0.5, px: 1 }}>
            <IconButton size="small" onClick={() => setYScaleIndex(Math.max(0, yScaleIndex - 1))} disabled={yScaleIndex === 0}><RemoveIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'center' }}>{currentYStep}人</Typography>
            <IconButton size="small" onClick={() => setYScaleIndex(Math.min(ySteps.length - 1, yScaleIndex + 1))} disabled={yScaleIndex === ySteps.length - 1}><AddIcon fontSize="small" /></IconButton>
          </Box>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} ticks={yTicks} domain={[0, 'dataMax']} />
              <Tooltip />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="ユーザー総数" stroke="#8E24AA" strokeWidth={3} />
              <Line type="monotone" dataKey="アクティブユーザー" stroke="#4285F4" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
          <Box sx={{ ...controlBaseSx, bottom: { xs: -40, sm: -5 }, right: 0, py: 0.5, px: 1 }}>
            <IconButton size="small" onClick={() => setXScaleIndex(Math.max(0, xScaleIndex - 1))} disabled={xScaleIndex === 0}><RemoveIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ fontWeight: 'bold', width: '50px', textAlign: 'center' }}>{currentXLabel}</Typography>
            <IconButton size="small" onClick={() => setXScaleIndex(Math.min(xScales.length - 1, xScaleIndex + 1))} disabled={xScales.length - 1 === xScaleIndex}><AddIcon fontSize="small" /></IconButton>
          </Box>
        </Box>
      </Paper>

      {/* 2. 統計カードセクション（グラフとリストの間に移動） */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'text.secondary' }}>
              <GroupIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>総ユーザー数</Typography>
            </Box>
            <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 'bold', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.totalUsers} <Typography component="span" variant="h6" color="text.secondary">人</Typography>
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: '#D4AF37' }}>
              <WorkspacePremiumIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>PRO会員</Typography>
            </Box>
            <Typography variant="h3" sx={{ color: '#D4AF37', fontWeight: 'bold', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.proUsers} <Typography component="span" variant="h6" color="text.secondary">人</Typography>
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'text.secondary' }}>
              <InventoryIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>アイテム総数</Typography>
            </Box>
            <Typography variant="h3" sx={{ color: '#0f172a', fontWeight: 'bold', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.totalItems} <Typography component="span" variant="h6" color="text.secondary">個</Typography>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 3. 顧客リストセクション（一番下） */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0', mb: 4 }}>
        <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 'bold', mb: 3 }}>顧客リスト</Typography>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }}>顧客</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }}>メールアドレス</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }}>プラン</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }}>役職</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#64748b' }} align="center">在庫数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const planStyle = getColorStyle(user.plan);
                const roleStyle = getColorStyle(user.role);

                return (
                  <TableRow key={user.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={user.image} sx={{ width: 32, height: 32 }} />
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{user.name || '未設定'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#475569' }}>{user.email}</TableCell>
                    <TableCell>
                      <Button
                        onClick={(e) => handleOpenMenu(e, user.id, 'plan')}
                        endIcon={<KeyboardArrowDownIcon />}
                        sx={{ 
                          borderRadius: '12px', fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'none',
                          bgcolor: planStyle.bg, color: planStyle.text,
                          border: `1.5px solid ${planStyle.border}`,
                          px: 2, '&:hover': { bgcolor: planStyle.bg, opacity: 0.8 }
                        }}
                      >
                        {user.plan === 'pro' ? 'PROプラン' : '無料プラン'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={(e) => handleOpenMenu(e, user.id, 'role')}
                        endIcon={<KeyboardArrowDownIcon />}
                        sx={{ 
                          borderRadius: '12px', fontSize: '0.875rem', fontWeight: 'bold', textTransform: 'none',
                          bgcolor: roleStyle.bg, color: roleStyle.text,
                          border: `1.5px solid ${roleStyle.border}`,
                          px: 2, '&:hover': { bgcolor: roleStyle.bg, opacity: 0.8 }
                        }}
                      >
                        {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={`${user._count?.items || 0} 品`} size="small" variant="outlined" sx={{ fontWeight: 'bold', color: '#64748b' }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* オーナー指定のカスタムMenuコンポーネント */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
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
        {menuTarget?.field === 'plan' && [
          <MenuItem key="free" onClick={() => handleSelectUpdate('free')} sx={{ fontWeight: 'bold', py: 1.5, borderRadius: '12px', mx: 1, color: '#1976d2' }}>無料プラン</MenuItem>,
          <MenuItem key="pro" onClick={() => handleSelectUpdate('pro')} sx={{ fontWeight: 'bold', py: 1.5, borderRadius: '12px', mx: 1, color: '#D4AF37' }}>PROプラン</MenuItem>
        ]}
        {menuTarget?.field === 'role' && [
          <MenuItem key="user" onClick={() => handleSelectUpdate('user')} sx={{ fontWeight: 'bold', py: 1.5, borderRadius: '12px', mx: 1, color: '#475569' }}>一般ユーザー</MenuItem>,
          <MenuItem key="admin" onClick={() => handleSelectUpdate('admin')} sx={{ fontWeight: 'bold', py: 1.5, borderRadius: '12px', mx: 1, color: '#8E24AA' }}>管理者</MenuItem>
        ]}
      </Menu>

      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 'bold', mb: 1 }}>PROプラン転換率</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          現在、 <strong style={{ color: '#0f172a' }}>{proPercentage.toFixed(1)}%</strong> がPROプランです。
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress variant="determinate" value={proPercentage} sx={{ height: 12, borderRadius: '16px', bgcolor: '#f8fafc', '& .MuiLinearProgress-bar': { bgcolor: '#D4AF37' } }} />
          </Box>
          <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 'bold' }}>{proPercentage.toFixed(1)}%</Typography>
        </Box>
      </Paper>
      
    </Box>
  );
}