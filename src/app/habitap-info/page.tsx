// src/app/habitap-info/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { 
  Box, Typography, Paper, Chip, IconButton, Avatar, Divider, Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BugReportIcon from '@mui/icons-material/BugReport';

// ==========================================
// リリースノートデータ定義
// ※新規バージョンを配列の先頭に追加してください
// ==========================================
const releaseNotes = [
  // ★ 追加：v2.3.0 サブスク管理とウェルカム通知
  {
    version: 'v2.3.0',
    date: '2026.03.13',
    title: 'サブスクリプション管理機能の完全開放とウェルカム通知の導入',
    features: [
      'PROプランのお客様専用の「契約内容の確認・解約（Stripeカスタマーポータル）」への直通ルートを開通',
      'PROプランのご契約完了と同時に、お客様の端末へ歓迎のWeb Push通知（ウェルカムメッセージ）をお届けする機能を実装',
      'Stripe Webhookの連携を強化し、サブスクリプション解約時の自動プラン降格（Free化）に完全対応',
      '支配人（Admin）専用の裏メニューとして、実機でのプッシュ通知テストボタンをアカウント画面に追加'
    ],
    fixes: [
      '本番環境（HTTPS）と開発環境における、Stripe決済フォームのセキュリティロック（入力不可状態）の制御を最適化',
      '顧客IDを持たないユーザーがカスタマーポータルへアクセスしようとした際の、エラーハンドリングを強化'
    ]
  },
  {
    version: 'v2.0.0',
    date: '2026.03.13',
    title: 'PROプラン決済基盤の完成とコンプライアンスの全面対応',
    features: [
      'Stripeを用いたPROプラン（月額100円のサブスクリプション）の埋め込み型決済システムを実装',
      'Webhook連携による、決済成功時のPROプラン自動アップグレード機能（自動権限付与）を実装',
      '決済完了後、瞬時に「PRO 会員」バッジが輝くシームレスな画面復帰・祝杯メッセージ機能を追加',
      '「特定商取引法に基づく表記」ページを新設し、利用規約・プライバシーポリシーと合わせた三種の法的ページを完備',
      '※本番公開の最終調整に向け、お客様を予期せぬ決済から守るため、アップグレード導線を一時的に「準備中」として封鎖しております'
    ],
    fixes: [
      '最新のStripe API仕様（2026-02-25.clover）に対応し、型定義の不整合によるビルドエラーを完全に解消',
      '一部ページにおけるコンポーネントの出力エラーを修正し、レンダリングの安定性を向上'
    ]
  },
  {
    version: 'v1.1.0',
    date: '2026.03.12',
    title: 'データ管理のクリーン化と、手動入力フォームの刷新',
    features: [
      '商品追加フローを「完全手動入力」へ刷新。外部サイトからの自動取得（スクレイピング）を廃止し、他社規約に依存しない安定的かつ合法的なデータ管理を実現',
      '無料版のパントリー登録上限（3品目まで）のシステムを正式導入',
      '4品目以上の登録を可能にする「PROプラン（月額サブスクリプション）」へのご案内機能を追加（決済システムは順次公開予定）',
      'アカウント画面に「利用規約」および「プライバシーポリシー」のリンクを追加し、サービスの透明性と信頼性を向上'
    ],
    fixes: [
      '外部サービスの仕様変更により、商品情報取得時に発生していた通信エラーと処理の遅延を根本的に解消'
    ]
  },
  {
    version: 'v1.0.0',
    date: '2026.03.11',
    title: '正式リリース および 商品情報取得ロジックの強化',
    features: [
      'Amazon URLからの商品名・画像取得処理を改善し、取得成功率を大幅に向上（プロキシ及び代替APIフォールバックの実装）',
      '在庫日数を自動判定する定期バッチ処理と、対象ユーザーへのWeb Push通知機能を追加',
      '利用実績（補充回数）に基づくPROプランへの自動アップグレード機能を実装',
      'WebAuthnを利用した生体認証（パスキー）によるログイン機能を追加'
    ],
    fixes: [
      '未ログイン状態でのAPIアクセス時におけるミドルウェアのルーティング制御を修正し、認証エラー時のクラッシュを解消',
      '型定義の不整合によるビルドエラーを修正'
    ]
  },
  {
    version: 'v0.9.0',
    date: '2026.03.05',
    title: 'ベータ版リリース：在庫管理システムの基礎機能実装',
    features: [
      '消耗品の在庫・消費日数を管理するコア機能の実装',
      'OAuth (Google) を利用したアカウント認証機能の導入',
      'ユーザーからのフィードバック送信機能を実装'
    ],
    fixes: []
  }
];

export default function HabitapInfoPage() {
  const router = useRouter();
  const currentVersion = releaseNotes[0].version;

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 800, mx: 'auto', pb: 12 }}>
      
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={() => router.back()} sx={{ mr: 1, bgcolor: '#f8fafc', '&:hover': { bgcolor: '#e2e8f0' } }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InfoOutlinedIcon sx={{ fontSize: 32, color: 'primary.main' }} /> HabiTap Info
        </Typography>
      </Box>

      {/* 現在のバージョン表示 */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', border: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', mb: 5, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}>
          <StarRoundedIcon sx={{ fontSize: 160 }} />
        </Box>
        <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: '0.1em', color: '#94a3b8' }}>
          Current Version
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: '900', letterSpacing: '-0.02em', mt: 1, textShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {currentVersion}
        </Typography>
      </Paper>

      {/* リリースノート一覧 */}
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 3, pl: 1 }}>
        リリースノート
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {releaseNotes.map((note, index) => (
          <Paper key={note.version} elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: '24px', border: index === 0 ? '2px solid #3b82f6' : '1px solid #e2e8f0', bgcolor: index === 0 ? '#f8fafc' : '#ffffff', position: 'relative' }}>
            
            {/* 最新バージョンラベル */}
            {index === 0 && (
              <Chip label="Latest" color="primary" size="small" sx={{ position: 'absolute', top: -12, left: 24, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }} />
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  {note.version} <Typography component="span" variant="subtitle1" sx={{ color: '#64748b', fontWeight: 'normal' }}>- {note.title}</Typography>
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 'bold', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '12px' }}>
                {note.date}
              </Typography>
            </Box>

            <Divider sx={{ my: 2, borderColor: '#e2e8f0' }} />

            {/* 新機能・改善 */}
            {note.features.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <AutoFixHighIcon fontSize="small" /> 新機能・改善
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 3, color: '#334155', '& li': { mb: 0.5 } }}>
                  {note.features.map((feature, i) => (
                    <Typography component="li" variant="body2" key={i}>{feature}</Typography>
                  ))}
                </Box>
              </Box>
            )}

            {/* バグ修正 */}
            {note.fixes.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ea580c', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <BugReportIcon fontSize="small" /> 修正された不具合
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 3, color: '#334155', '& li': { mb: 0.5 } }}>
                  {note.fixes.map((fix, i) => (
                    <Typography component="li" variant="body2" key={i}>{fix}</Typography>
                  ))}
                </Box>
              </Box>
            )}

          </Paper>
        ))}
      </Box>

    </Box>
  );
}