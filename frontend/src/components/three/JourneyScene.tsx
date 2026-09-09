'use client';

import React, { useState, useEffect } from 'react';
import { Plane, AlertTriangle, ShieldCheck, Clock, MapPin } from 'lucide-react';

interface JourneySceneProps {
  disruptionState?: 'normal' | 'delayed' | 'risk';
}

export default function JourneyScene({ disruptionState = 'risk' }: JourneySceneProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full h-full min-h-[350px] relative rounded-2xl overflow-hidden hud-card border border-sky-500/30 p-6 flex flex-col justify-between bg-gradient-to-b from-slate-900/90 via-slate-950 to-navy-950">
      {/* Background Radar Sweeper & Grid Texture */}
      <div className="absolute inset-0 aviation-grid-bg opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-sky-500/10 pointer-events-none opacity-30 animate-pulse-slow" />

      {/* Top Header Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur text-xs font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-amber-300 uppercase">UL001 Inbound Delay +90m</span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
          Route Telemetry Active
        </div>
      </div>

      {/* Center SVG Interactive Flight Route Arc */}
      <div className="relative z-10 my-4 w-full h-48 flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200" fill="none">
          {/* Defs for gradients & filters */}
          <defs>
            <linearGradient id="leg1Gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="leg2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Leg 1 Arc: CMB (80, 140) -> KUL (300, 70) */}
          <path
            d="M 80 140 Q 190 30 300 70"
            stroke="url(#leg1Gradient)"
            strokeWidth="3.5"
            fill="none"
            filter="url(#glow)"
          />

          {/* Leg 2 Arc: KUL (300, 70) -> NRT (520, 130) */}
          <path
            d="M 300 70 Q 410 20 520 130"
            stroke="url(#leg2Gradient)"
            strokeWidth="3"
            strokeDasharray="6 6"
            fill="none"
            filter="url(#glow)"
            className="animate-pulse"
          />

          {/* Alternative Route Arc: CMB (80, 140) -> SIN (270, 110) -> NRT (520, 130) */}
          <path
            d="M 80 140 Q 300 170 520 130"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4 4"
            fill="none"
            opacity="0.7"
          />

          {/* City Nodes */}
          {/* CMB Node */}
          <g transform="translate(80, 140)">
            <circle r="7" fill="#0ea5e9" className="animate-ping opacity-75" />
            <circle r="5" fill="#0ea5e9" />
            <text x="-15" y="24" fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="bold">CMB</text>
          </g>

          {/* KUL Node */}
          <g transform="translate(300, 70)">
            <circle r="8" fill="#f59e0b" className="animate-ping opacity-75" />
            <circle r="6" fill="#f59e0b" />
            <text x="-15" y="-14" fill="#f59e0b" fontSize="12" fontFamily="monospace" fontWeight="bold">KUL (Transfer Risk)</text>
          </g>

          {/* NRT Node */}
          <g transform="translate(520, 130)">
            <circle r="6" fill="#ef4444" />
            <text x="-12" y="24" fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="bold">NRT</text>
          </g>
        </svg>
      </div>

      {/* Bottom Telemetry Footer */}
      <div className="relative z-10 grid grid-cols-2 gap-4 text-xs font-mono pt-3 border-t border-slate-800/80">
        <div className="flex items-center space-x-2 text-slate-300">
          <Clock className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>KUL Connection Window: <strong className="text-red-400 font-bold">30m (-30m MCT)</strong></span>
        </div>
        <div className="flex items-center justify-end space-x-2 text-emerald-400 font-bold">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Protected Carrier Rebooking Available</span>
        </div>
      </div>
    </div>
  );
}
