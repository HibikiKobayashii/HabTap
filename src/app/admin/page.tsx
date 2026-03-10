// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, CircularProgress, Card, CardContent, 
  LinearProgress, Button, Divider, IconButton 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupIcon from '@mui/icons-material/Group';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import InventoryIcon from '@mui/icons-material/Inventory';
import SecurityIcon from '@mui/icons-material/Security';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAdminStats, getAdminChartData } from '../actions';

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
  const [pageLoading, setPageLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

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
        !stats ? getAdminStats() : Promise.resolve(stats),
        getAdminChartData(currentXScale)
      ])
        .then(([statsData, chart]) => {
          if (!stats) setStats(statsData);
          setChartData(chart);
          setPageLoading(false);
          setChartLoading(false);
        }).catch((err) => {
          console.error("統計データの抽出に失敗しました:", err);
          setPageLoading(false);
          setChartLoading(false);
        });
    }
  }, [session, status, isAdmin, router, currentXScale]);

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
    position: 'absolute',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    bgcolor: 'rgba(255,255,255,0.95)',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    backdropFilter: 'blur(4px)'
  };

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 1000, mx: 'auto', pb: 12 }}>
      
     

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1.5 }}>
        <SecurityIcon sx={{ fontSize: 32, color: '#8E24AA' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: '-0.02em', fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          管理者ダッシュボード
        </Typography>
      </Box>

      {/* 統計カードセクション */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'text.secondary' }}>
              <GroupIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>総ユーザー数</Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.totalUsers} <Typography component="span" variant="h6" color="text.secondary">人</Typography>
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: '#D4AF37' }}>
              <WorkspacePremiumIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>PRO会員</Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#D4AF37', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.proUsers} <Typography component="span" variant="h6" color="text.secondary">人</Typography>
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'text.secondary' }}>
              <InventoryIcon /><Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>アイテム総数</Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 'bold', fontSize: { xs: '2.5rem', sm: '3rem' } }}>
              {stats.totalItems} <Typography component="span" variant="h6" color="text.secondary">個</Typography>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* ★ 修正：お皿の底（pb）をさらに深く（13）しました */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, md: 5 }, 
          pb: { xs: 13, md: 6 }, 
          borderRadius: '32px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)', 
          mb: 4 
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>アクティブユーザー推移</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 6, sm: 4 } }}>
          登録者と実働者数の推移です。
        </Typography>

        <Box sx={{ position: 'relative', width: '100%', height: 400, pt: { xs: 2, sm: 0 } }}>
          
          {chartLoading && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, bgcolor: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <CircularProgress size={40} />
            </Box>
          )}

          {/* Y軸コントローラー */}
          <Box sx={{ 
            ...controlBaseSx, 
            flexDirection: 'row', 
            top: { xs: -35, sm: 20 }, 
            left: { xs: 0, sm: -15 }, 
            py: 0.5, 
            px: 1 
          }}>
            <IconButton size="small" onClick={() => setYScaleIndex(Math.max(0, yScaleIndex - 1))} disabled={yScaleIndex === 0}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'center', color: '#475569' }}>
              {currentYStep}人
            </Typography>
            <IconButton size="small" onClick={() => setYScaleIndex(Math.min(ySteps.length - 1, yScaleIndex + 1))} disabled={yScaleIndex === ySteps.length - 1}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>

          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} ticks={yTicks} domain={[0, 'dataMax']} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="ユーザー総数" stroke="#8E24AA" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={500} />
              <Line type="monotone" dataKey="アクティブユーザー" stroke="#4285F4" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={500} />
            </LineChart>
          </ResponsiveContainer>

          {/* ★ 修正：X軸コントローラー。さらに下（-40px）へずらしました */}
          <Box sx={{ 
            ...controlBaseSx, 
            flexDirection: 'row', 
            bottom: { xs: -40, sm: -5 }, 
            right: 0,
            py: 0.5,
            px: 1
          }}>
            <IconButton size="small" onClick={() => setXScaleIndex(Math.max(0, xScaleIndex - 1))} disabled={xScaleIndex === 0}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ fontWeight: 'bold', width: '50px', textAlign: 'center', color: '#475569' }}>
              {currentXLabel}
            </Typography>
            <IconButton size="small" onClick={() => setXScaleIndex(Math.min(xScales.length - 1, xScaleIndex + 1))} disabled={xScaleIndex === xScales.length - 1}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* コンバージョンセクション */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>PROプラン転換率</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          現在、 <strong>{proPercentage.toFixed(1)}%</strong> がPROプランです。
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress variant="determinate" value={proPercentage} sx={{ height: 12, borderRadius: '16px', backgroundColor: '#f8fafc', '& .MuiLinearProgress-bar': { backgroundColor: '#D4AF37', borderRadius: '16px' } }} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 40, textAlign: 'right' }}>
            {proPercentage.toFixed(1)}%
          </Typography>
        </Box>
        
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Divider sx={{ my: 4 }} />
        </Box>
      </Paper>
      
    </Box>
  );
}