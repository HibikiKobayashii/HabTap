// src/app/theme.ts
'use client';
import { createTheme } from '@mui/material/styles';
import { blue, lightBlue } from '@mui/material/colors';

export const theme = createTheme({
  palette: {
    primary: {
      main: blue[700],
      light: lightBlue[300],
    },
    secondary: {
      main: lightBlue[500],
    },
    background: {
      default: '#f0f4f8',
    },
  },
  shape: {
    // ほんの少し丸みを抑え、IBM Plexの建築的な美しさに合わせます
    borderRadius: 12, 
  },
  typography: {
    // ★ 先にInterの透明感で英数字を受け、残りの日本語をIBM Plexの緻密さで組み上げます
    fontFamily: [
      'var(--font-inter)',
      'var(--font-ibm-plex)',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    
    // 文字の太さ（ウェイト）も、このフォントが最も美しく見えるバランスに調整
    h4: { fontWeight: 700, letterSpacing: '-0.02em' }, // タイトルは少し字間を詰めて緊張感を
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    button: { fontWeight: 600, textTransform: 'none' }, // ボタンの文字もスタイリッシュに
  },
});