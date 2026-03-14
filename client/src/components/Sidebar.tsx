import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  TrendingUp,
  AlertTriangle,
  Target
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trades", label: "Trades", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "mistakes", label: "Mistakes", icon: AlertTriangle },
  { id: "lossTracker", label: "Loss Tracker", icon: Target },
  { id: "advanced", label: "Advanced Analytics", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [title, setTitle] = useState<string>(() => {
    try {
      return localStorage.getItem('journalTitle') || 'Your Journal';
    } catch {
      return 'Your Journal';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('journalTitle', title);
    } catch {}
  }, [title]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="w-[230px] flex-shrink-0 border-r border-[#252525] flex flex-col p-4 sticky top-0 max-h-screen"
      style={{
        background: "radial-gradient(circle at top, #141414 0, #050505 45%, #020202 100%)",
        boxShadow: "12px 0 40px rgba(0, 0, 0, 0.9)",
      }}
    >
      <div className="px-1.5 pb-2">
        <div
          className="p-3 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.01)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-[#ead2d2] font-extrabold text-xl placeholder:text-[#c9a9a9] tracking-wide"
            style={{
              outline: 'none',
              letterSpacing: '0.4px',
              fontFamily: "'M PLUS Rounded 1c','Noto Sans JP','Segoe UI',Roboto,system-ui,-apple-system",
              textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 6px 18px rgba(139,92,246,0.14)'
            }}
            data-testid="sidebar-title"
            aria-label="Edit journal title"
            placeholder="Your Journal"
          />
            {/* description intentionally removed per user request */}
        </div>
      </div>

      <div className="mt-3.5 flex-1 flex flex-col gap-4">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-[#b8b8b8] opacity-80 mb-1.5 px-1.5">
            Main
          </div>
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  data-testid={`nav-${item.id}`}
                  className="rounded-full border px-2.5 py-1.5 text-[0.8rem] flex items-center gap-2.5 cursor-pointer transition-all duration-150"
                  style={{
                    background: isActive 
                      ? "radial-gradient(circle at left, rgba(79, 195, 247, 0.08), rgba(8, 8, 8, 0.98))"
                      : "transparent",
                    borderColor: isActive ? "rgba(139, 92, 246, 0.35)" : "transparent",
                    color: isActive ? "#ffffff" : "#a0a0a0",
                    boxShadow: "none",
                  }}
                >
                  <div 
                    className="w-2 h-2 rounded-full transition-all duration-150 flex-shrink-0"
                    style={{
                      background: "#8b5cf6",
                      boxShadow: "0 0 6px rgba(139, 92, 246, 0.22)",
                      opacity: isActive ? 0.35 : 0,
                      transform: isActive ? "scale(1)" : "scale(0.4)",
                    }}
                  />
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-[rgba(37,37,37,0.9)] mt-2.5 text-[0.7rem] text-[#b8b8b8] flex flex-col gap-1">
        <div className="w-full flex items-center justify-center py-3">
          <div
            className="rounded-xl px-4 py-3 text-center"
            style={{
              background: 'rgba(8,8,8,0.5)',
              width: 'fit-content',
              boxShadow: '0 10px 30px rgba(139,92,246,0.04), inset 0 -4px 12px rgba(0,0,0,0.6)'
            }}
            aria-label="Local time"
          >
            <div
              className="leading-none"
              style={{
                color: '#e6d7d7',
                fontFamily: "'JetBrains Mono','SFMono-Regular','Roboto Mono', 'M PLUS Rounded 1c', system-ui, -apple-system",
                fontVariantNumeric: 'tabular-nums',
                fontSize: '18px',
                fontWeight: 700,
                textShadow: '0 2px 6px rgba(0,0,0,0.6), 0 8px 22px rgba(139,92,246,0.10)'
              }}
            >
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[0.64rem] mt-1" style={{ color: '#9ea2a2', fontFamily: "'M PLUS Rounded 1c','Noto Sans JP', system-ui" }}>
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
