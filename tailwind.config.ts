import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // CivilOS Unified Design System — Light Clean
        bg: {
          primary: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#f3f4f6',
          card: '#ffffff',
        },
        border: {
          DEFAULT: '#e5e7eb',
          light: '#eef0f3',
          accent: '#d1d5db',
        },
        civil: {
          red: '#dc2626',
          orange: '#d97706',
          yellow: '#d97706',
          green: '#059669',
          blue: '#1a56db',
          cyan: '#0891b2',
          purple: '#7c3aed',
          pink: '#db2777',
        },
        text: {
          primary: '#111827',
          secondary: '#374151',
          muted: '#6b7280',
          dim: '#9ca3af',
        },
        primary: {
          DEFAULT: '#1a56db',
          dark: '#1e429f',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        bengali: ['Hind Siliguri', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(220, 38, 38, 0.15)',
        'glow-blue': '0 0 20px rgba(26, 86, 219, 0.15)',
        'glow-green': '0 0 20px rgba(5, 150, 105, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
