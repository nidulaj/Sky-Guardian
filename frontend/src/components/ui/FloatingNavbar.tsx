'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Plane, ArrowRight, Menu, X } from 'lucide-react';

export default function FloatingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-6xl transition-all duration-300 rounded-2xl ${
        scrolled
          ? 'bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow-2xl shadow-slate-950/80 py-3 px-6'
          : 'bg-transparent py-4 px-6 border border-slate-800/40'
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl group-hover:border-sky-400 transition">
            <Shield className="w-5 h-5 text-sky-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white flex items-center space-x-1">
            <span>SkyGuardian</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              AI
            </span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          <a href="#overview" className="hover:text-sky-400 transition">
            Overview
          </a>
          <a href="#how-it-works" className="hover:text-sky-400 transition">
            How It Works
          </a>
          <a href="#agents" className="hover:text-sky-400 transition">
            Multi-Agent Architecture
          </a>
          <a href="#risk-engine" className="hover:text-sky-400 transition">
            Risk Engine
          </a>
        </div>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center space-x-4">
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link
            href="/journeys/new"
            className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-600/20 transition flex items-center space-x-2 border border-sky-400/30"
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Analyze Journey</span>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-slate-800 flex flex-col space-y-3 text-sm text-slate-300 pb-2">
          <a href="#overview" onClick={() => setMobileOpen(false)} className="hover:text-sky-400">
            Overview
          </a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="hover:text-sky-400">
            How It Works
          </a>
          <a href="#agents" onClick={() => setMobileOpen(false)} className="hover:text-sky-400">
            Multi-Agent Architecture
          </a>
          <div className="pt-2 flex flex-col space-y-2">
            <Link
              href="/login"
              className="py-2 text-center text-xs font-semibold text-slate-300 bg-slate-900 rounded-lg border border-slate-800"
            >
              Sign In
            </Link>
            <Link
              href="/journeys/new"
              className="py-2.5 text-center text-xs font-bold bg-sky-600 text-white rounded-lg shadow"
            >
              Analyze Journey
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
