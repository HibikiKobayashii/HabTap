// src/components/Navigation.tsx
'use client';
import * as React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, Avatar, Box } from '@mui/material';
import { 
  Home, HomeOutlined, 
  Inventory, InventoryOutlined, 
  LocalShipping, LocalShippingOutlined, 
  Dashboard, DashboardOutlined, 
  Forum, ForumOutlined 
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === '/login') return null;

  const isAdmin = (session?.user as any)?.role === 'admin';

  // =========================================
  // ★ 一般席用スパイス（青色で光る）
  // =========================================
  const actionSx = {
    minWidth: { xs: 'auto', sm: '100px' }, 
    padding: { xs: '6px 4px', sm: '6px 16px' },
    color: '#94a3b8', 
    transition: 'none', 
    '&.Mui-selected': {
      color: '#3b82f6', // 一般席は「美しい青」
      paddingTop: { xs: '6px', sm: '6px' }, 
    },
    '& .MuiBottomNavigationAction-label': {
      whiteSpace: 'nowrap', 
      fontSize: { xs: '0.65rem', sm: '0.8rem' }, 
      fontWeight: '500',
      transition: 'none', 
    },
    '& .MuiBottomNavigationAction-label.Mui-selected': {
      fontSize: { xs: '0.65rem', sm: '0.8rem' }, 
    },
    '& .MuiSvgIcon-root': {
      fontSize: '1.5rem', 
      transition: 'none', 
    }
  };

  // =========================================
  // ★ オーナー（VIP）専用スパイス（紫色で光る）
  // =========================================
  const adminActionSx = {
    ...actionSx,
    '&.Mui-selected': {
      color: '#8b5cf6', // 支配人の権限を示す「高貴な紫」
      paddingTop: { xs: '6px', sm: '6px' }, 
    },
  };

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, boxShadow: '0 -4px 24px rgba(0,0,0,0.04)' }} elevation={3}>
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', bgcolor: '#ffffff' }}>
        <BottomNavigation
          showLabels
          value={pathname}
          onChange={(_, newValue) => {
            router.push(newValue);
          }}
          sx={{
            width: '100%',
            maxWidth: '900px', 
            justifyContent: 'center',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {/* === 全員が見える一般メニュー === */}
          <BottomNavigationAction 
            value="/" 
            label="ホーム" 
            icon={pathname === '/' ? <Home /> : <HomeOutlined />} 
            sx={actionSx} 
          />
          <BottomNavigationAction 
            value="/pantry" 
            label="パントリー" 
            icon={pathname === '/pantry' ? <Inventory /> : <InventoryOutlined />} 
            sx={actionSx} 
          />
          <BottomNavigationAction 
            value="/stock-in" 
            label="仕入れ" 
            icon={pathname === '/stock-in' ? <LocalShipping /> : <LocalShippingOutlined />} 
            sx={actionSx} 
          />
          <BottomNavigationAction 
            value="/account" 
            label="アカウント" 
            icon={<Avatar src={session?.user?.image || ''} sx={{ width: 24, height: 24, border: pathname === '/account' ? '2px solid #3b82f6' : 'none' }} />} 
            sx={actionSx} 
          />

          {/* === 経営者専用メニュー（紫色の魔法） === */}
          {isAdmin && (
            <BottomNavigationAction 
              value="/admin" 
              label="経営ダッシュ" 
              icon={pathname === '/admin' ? <Dashboard /> : <DashboardOutlined />} 
              sx={{
                ...adminActionSx, // ★ ここに紫色のスパイスを適用
                borderLeft: '1px solid #e2e8f0', 
                marginLeft: { xs: 0.5, sm: 2 }, 
                paddingLeft: { xs: 1, sm: 3 }, 
              }} 
            />
          )}
          {isAdmin && (
            <BottomNavigationAction 
              value="/feedback" 
              label="Voix(声)" 
              icon={pathname === '/feedback' ? <Forum /> : <ForumOutlined />} 
              sx={adminActionSx} // ★ ここにも紫色のスパイスを適用
            />
          )}

        </BottomNavigation>
      </Box>
    </Paper>
  );
}