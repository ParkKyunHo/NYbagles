import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 뉴욕러브 베이글 브랜드 컬러
        'bagel-yellow': {
          DEFAULT: '#FDB813',
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FDB813',  // 메인 노란색
          600: '#E5A50C',
          700: '#CC9200',
          800: '#997000',
          900: '#664A00',
        },
        'bagel-black': '#1A1A1A',
        'bagel-cream': '#F5F0E6',
        'bagel-brown': '#8B4513',
        
        // 기존 primary 컬러를 브랜드 컬러로 매핑
        primary: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FDB813',
          600: '#E5A50C',
          700: '#CC9200',
          800: '#997000',
          900: '#664A00',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        display: ['Bebas Neue', 'Pretendard', 'sans-serif'], // 로고 스타일 폰트
      },
      screens: {
        'xs': '475px',
        // 기본 breakpoints는 자동으로 포함됨
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config