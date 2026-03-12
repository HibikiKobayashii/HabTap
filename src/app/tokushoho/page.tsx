// src/app/tokushoho/page.tsx
'use client';
import { Box, Typography, Paper, Button, Divider, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function TokushohoPage() {
  const router = useRouter();
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/');
    return null;
  }

  // ★ オーナーの品格を守る、誠実な言い回しにブラッシュアップ
  const sincereDisclosure = "個人情報保護および防犯の観点から、所在地および電話番号については本ページ上では非公開としております。特定商取引法に基づき、下記メールアドレス宛にご請求いただければ、遅滞なく電磁的記録（電子メール等）により提供いたします。";

  const infoList = [
    { label: '販売事業者名', value: '小林 響' },
    { label: '所在地', value: sincereDisclosure },
    { label: '電話番号', value: sincereDisclosure },
    { label: 'メールアドレス', value: 'osomatsu287@gmail.com' },
    { label: '販売価格', value: 'PROプラン：月額100円（税込）' },
    { label: '商品代金以外に必要な料金', value: '当サイトの閲覧、サービスの利用に必要となるインターネット接続料金、通信料金等はお客様の負担となります。' },
    { label: '支払方法', value: 'クレジットカード決済（Stripeを使用）' },
    { 
      label: '代金の支払時期', 
      value: '初回お申し込み時に決済が発生し、2回目以降は毎月1日に自動決済が行われます。' 
    },
    { label: 'サービスの提供時期', value: 'クレジットカード決済完了後、ただちにご利用いただけます。' },
    { label: '返品・キャンセルに関する特約', value: '提供するデジタルサービスの性質上、購入後のキャンセルや返金には応じられません。サブスクリプションの解約は、アカウント設定画面からいつでも可能であり、解約手続き後も次回更新日までは引き続きサービスをご利用いただけます。' },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => router.back()} 
        sx={{ mb: 3, color: 'text.secondary', fontWeight: 'bold' }}
      >
        戻る
      </Button>

      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a' }}>
        特定商取引法に基づく表記
      </Typography>

      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, md: 5 }, 
          borderRadius: '32px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
          bgcolor: '#ffffff'
        }}
      >
        {infoList.map((item, index) => (
          <Box key={index} sx={{ mb: index === infoList.length - 1 ? 0 : 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 0.5 }}>
              {item.label}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.8 }}>
              {item.value}
            </Typography>
            {index !== infoList.length - 1 && <Divider sx={{ mt: 3, borderColor: '#f1f5f9' }} />}
          </Box>
        ))}
      </Paper>
      
      <Typography variant="caption" sx={{ display: 'block', mt: 4, textAlign: 'center', color: '#94a3b8' }}>
        HabiTap Official Business Information
      </Typography>
    </Box>
  );
}