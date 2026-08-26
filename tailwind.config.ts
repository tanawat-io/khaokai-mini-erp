import type { Config } from 'tailwindcss';

// Approved warm-orange palette (locked — do not change without product approval)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // present for the class hook, but V1 ships light-only — no dark: variants are used
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      colors: {
        orange: {
          50: '#FFF4EC',
          100: '#FFE4D1',
          200: '#FFC9A3',
          300: '#FFA968',
          400: '#FF8F3D',
          500: '#F2731A',
          600: '#D65F0F',
          700: '#B04A0A',
          800: '#833707',
          900: '#5C2705',
        },
        cream: {
          50: '#FFFDFB',
          100: '#FDF6EE',
          200: '#FAEEE0',
          300: '#F3E0C9',
          400: '#E8CDA8',
        },
        warmgray: {
          50: '#FAF8F6',
          100: '#F3EFEA',
          200: '#E7E1D9',
          300: '#D3CAC0',
          400: '#A99E92',
          500: '#7D7468',
          600: '#5C5548',
          700: '#433E35',
          800: '#2D2A24',
          900: '#1C1A16',
        },
        success: {
          50: '#EDFBF0',
          500: '#1E9E5A',
          600: '#187F48',
          700: '#136339',
        },
        warning: {
          50: '#FFF8E8',
          500: '#E0A100',
          600: '#B57F00',
          700: '#8C6300',
        },
        danger: {
          50: '#FDECEC',
          500: '#DC3545',
          600: '#C22A39',
          700: '#A11F2C',
        },
        info: {
          50: '#EEF4FD',
          500: '#3B7DDB',
          600: '#2E63B0',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      spacing: {
        4.5: '18px',
      },
      boxShadow: {
        resting: '0 1px 3px 0 rgba(28,26,22,0.06)',
        raised: '0 4px 12px -2px rgba(28,26,22,0.08), 0 1px 3px 0 rgba(28,26,22,0.04)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
