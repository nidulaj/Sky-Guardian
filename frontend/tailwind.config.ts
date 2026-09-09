import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aviation: {
          bg: '#030712',        // Deepest Cockpit Midnight
          surface: '#0B1528',   // Radar Slate Base
          elevated: '#112240',  // Floating HUD Panel
          border: '#1E2D4A',    // Subtle Instrument Line
          borderGlow: '#0EA5E9',// Active Node Cyan
          cyan: '#0EA5E9',      // Primary Telemetry
          sky: '#38BDF8',       // Secondary Flight Curve
          amber: '#F59E0B',     // Delay/Disruption Warning
          red: '#EF4444',       // Critical Risk / Missed Transfer
          emerald: '#10B981',   // Verified Safe Route
          muted: '#64748B',     // Secondary Telemetry Text
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': "radial-gradient(circle, rgba(14, 165, 233, 0.08) 1px, transparent 1px)",
        'hud-glow': "radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.15), transparent 70%)",
        'warning-glow': "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.12), transparent 70%)",
        'danger-glow': "radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.15), transparent 70%)",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radarSweep 6s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
