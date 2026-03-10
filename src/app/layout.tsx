// src/app/layout.tsx
import './globals.css';
import ThemeRegistry from '@/components/ThemeRegistry'; 
import AuthProvider from '@/components/AuthProvider'; 
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'HabiTap',
  description: '消耗品管理パントリー',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      {/* ★ 修正点：bodyの背景色はglobals.cssに任せるのがプロの隠し味ですが、
          ここで指定する場合は、サーバーとブラウザで食い違わないよう細心の注意を払います。
      */}
      <body suppressHydrationWarning style={{ margin: 0, backgroundColor: '#dceaf8' }}>
        <AuthProvider>
          <ThemeRegistry>
            {/* =========================================
                ★ 究極の解決（リダックス）：
                余計な層（div）を一枚剥がし、<main> タグに直接スタイルを盛り付けます。
                これにより、MUIが注入する <style> タグと React の DOM 構築が
                衝突する隙間（えぐみ）を完全に封じ込めます。
                ========================================= */}
            <main style={{ paddingBottom: '70px', minHeight: '100vh' }}>
              {children}
            </main>
            {/* ナビゲーションは main の外、しかし ThemeRegistry の中に置くのがマナーです */}
            <Navigation />
          </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}