// src/app/about/page.tsx
'use client';

import { Box, Typography, Paper, Divider, Button, Avatar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

export default function AboutPage() {
  const router = useRouter();

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: { xs: 14, md: 16 } }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => router.push('/account')}
        sx={{ mb: 3, color: 'text.secondary', fontWeight: 'bold' }}
      >
        アカウントへ戻る
      </Button>

      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#0f172a' }}>
        About HabiTap
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
        
        {/* =========================================
            1. ビジョン
            ========================================= */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#0f172a' }}>
          思考をゼロにする、新しい在庫管理
        </Typography>
        <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.8 }}>
          HabiTap（ハビタップ）は、「名もなき家事」から思考の負担を取り除くために生まれました。
          日用品が「いつの間にかなくなっている」というストレス。それを解決するために、タップ一つで在庫を管理し、時間経過による自動消費とプッシュ通知を組み合わせることで、管理そのものを意識させない体験を目指しています。
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* =========================================
            2. 開発者プロフィール
            ========================================= */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: '#0f172a' }}>
          Developer Profile
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.2rem', fontWeight: 'bold' }}>
            しの
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
              しのののめ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              開志専門職大学 情報学部 3年
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" sx={{ color: '#475569', mb: 4, lineHeight: 1.8 }}>
          新潟を拠点に活動する学生エンジニア。開志専門職大学にてIoT技術とWebアプリケーションの開発を専攻しています。
          大学の企業内実習での経験を基に、ユーザー体験（UX）を最優先したプロダクト開発に取り組んでいます。HabiTapは、その実践の第一歩として、自身の日常生活における課題を解決するためにフルスタックで開発しました。
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* =========================================
            3. ポリシー
            ========================================= */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#0f172a' }}>
          ポリシーと注意事項
        </Typography>
        
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>
          在庫数と消費予測について
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 3, lineHeight: 1.8 }}>
          本アプリで表示される在庫数および残り日数は、設定された消費ペースに基づくシミュレーション値です。実際の使用状況により差異が生じる場合があります。プッシュ通知はあくまで「買い忘れ防止」の補助機能としてご利用ください。
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#0f172a' }}>
          プライバシーとセキュリティ
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 0, lineHeight: 1.8 }}>
          お客様の登録データは、最新の暗号化技術および生体認証（WebAuthn）を用いて厳重に保護されています。取得した情報はアプリの機能提供および利便性向上のためにのみ使用し、法令に基づく場合を除き、第三者に提供することはありません。
        </Typography>

      </Paper>
    </Box>
  );
}