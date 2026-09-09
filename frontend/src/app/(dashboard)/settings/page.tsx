'use client';

import React, { useState } from 'react';
import FloatingNavbar from '@/components/ui/FloatingNavbar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Settings, Shield, Lock, Globe2, Bell, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState('en');
  const [minimizeData, setMinimizeData] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <FloatingNavbar />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20 space-y-8">
        {/* Page Header */}
        <div className="border-b border-slate-900 pb-6">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-sky-400 uppercase">
            <Settings className="w-4 h-4" />
            <span>Passenger Configuration & Responsible AI</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            Settings & Privacy Controls
          </h1>
        </div>

        {saved && (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Settings updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Preferred Language Card */}
          <Card className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <Globe2 className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-bold text-white">Language & Localization</h3>
                <p className="text-xs text-slate-400">Select preferred language for disruption recommendations.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { code: 'en', label: 'English' },
                { code: 'si', label: 'සිංහල (Sinhala)' },
                { code: 'ta', label: 'தமிழ் (Tamil)' },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLang(item.code)}
                  className={`p-3 rounded-xl border text-xs font-mono font-bold transition text-center ${
                    lang === item.code
                      ? 'bg-sky-600/20 border-sky-400 text-sky-300 glow-cyan'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Privacy & Data Minimization Card */}
          <Card className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white">Data Minimization & Security</h3>
                <p className="text-xs text-slate-400">Responsible AI rules for personal data protection.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs font-mono">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <div>
                  <span className="text-slate-200 font-bold block">Strict Data Minimization</span>
                  <span className="text-slate-500 text-[11px]">Only store necessary flight numbers and dates. No passport/national ID collection.</span>
                </div>
                <input
                  type="checkbox"
                  checked={minimizeData}
                  onChange={(e) => setMinimizeData(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <div>
                  <span className="text-slate-200 font-bold block">Proactive Disruption Risk Alerts</span>
                  <span className="text-slate-500 text-[11px]">Receive early notifications when inbound delay risk exceeds configured threshold (60/100).</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
              </label>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save Preferences
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
