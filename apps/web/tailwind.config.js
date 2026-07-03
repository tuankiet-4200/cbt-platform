/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Color System ────────────────────────────────────────────────────
      // Primary: Professional blue for exam/education context
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Main primary
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8f',
          950: '#172554',
        },
        // Accent: Indigo for highlights
        accent: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        // Success: Correct answers, completed states
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Danger: Wrong answers, errors
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Warning: Flagged questions, time warnings
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Neutral: UI backgrounds and borders
        neutral: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Exam UI states (question navigator)
        'q-unanswered': '#e2e8f0',   // Gray — not yet answered
        'q-answered':   '#3b82f6',   // Blue — answered
        'q-flagged':    '#f59e0b',   // Amber — flagged for review
        'q-skipped':    '#94a3b8',   // Light gray — explicitly skipped
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // ── Border Radius ────────────────────────────────────────────────────
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      // ── Box Shadows ──────────────────────────────────────────────────────
      boxShadow: {
        'soft':  '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card':  '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'exam':  '0 8px 32px rgba(59, 130, 246, 0.08)',
      },

      // ── Animation ────────────────────────────────────────────────────────
      animation: {
        'fade-in':     'fadeIn 0.2s ease-in-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-down':  'slideDown 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'spin-slow':   'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },

      // ── Screen breakpoints ───────────────────────────────────────────────
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
};
