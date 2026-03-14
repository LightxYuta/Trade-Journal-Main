import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, BarChart3,
  Settings, AlertTriangle, Target
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navItems = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "trades",      label: "Trades",       icon: FileText },
  { id: "analytics",   label: "Analytics",    icon: BarChart3 },
  { id: "mistakes",    label: "Mistakes",     icon: AlertTriangle },
  { id: "lossTracker", label: "Loss Tracker", icon: Target },
  { id: "settings",    label: "Settings",     icon: Settings },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [now, setNow] = useState(new Date());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [title, setTitle] = useState(() => {
    try { return localStorage.getItem('journalTitle') || 'कर्मण्येव अधिकारः'; }
    catch { return 'कर्मण्येव अधिकारः'; }
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('journalTitle', title); } catch {}
  }, [title]);

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col sticky top-0 max-h-screen"
      style={{
        background: "#0a0a0a",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Top green accent */}
      <div className="h-[2px] w-full flex-shrink-0" style={{
        background: "linear-gradient(90deg, rgba(0,210,138,0) 0%, rgba(0,210,138,0.5) 40%, rgba(0,210,138,0.5) 60%, rgba(0,210,138,0) 100%)"
      }} />

      {/* Title */}
      <div className="px-5 pt-5 pb-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent focus:outline-none placeholder-[#333]"
          style={{
            color: "#ead2d2",
            fontFamily: "'M PLUS Rounded 1c','Noto Sans JP', system-ui",
            fontWeight: 800,
            fontSize: "20px",
            letterSpacing: "0.4px",
            textShadow: "0 1px 0 rgba(0,0,0,0.6)",
          }}
          placeholder="Your Journal"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const isHovered = hoveredItem === item.id && !isActive;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              data-testid={`nav-${item.id}`}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl relative overflow-hidden"
              style={{
                transition: "background 0.15s ease, color 0.15s ease",
                background: isActive
                  ? "rgba(0,210,138,0.08)"
                  : isHovered
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
                color: isActive ? "#ffffff" : isHovered ? "#aaaaaa" : "#444444",
              }}
            >
              {/* Active bar */}
              <div
                className="absolute left-0 top-1/2 rounded-r-full flex-shrink-0"
                style={{
                  width: "2px",
                  height: isActive ? "55%" : "0%",
                  transform: "translateY(-50%)",
                  background: "linear-gradient(180deg, #00d28a, #00ff9d)",
                  boxShadow: isActive ? "0 0 8px rgba(0,210,138,0.5)" : "none",
                  transition: "height 0.2s ease, box-shadow 0.2s ease",
                }}
              />

              <Icon
                className="flex-shrink-0"
                style={{
                  width: "15px",
                  height: "15px",
                  color: isActive ? "#00d28a" : isHovered ? "#777" : "#333",
                  transition: "color 0.15s ease",
                }}
              />
              <span
                className="font-medium"
                style={{
                  fontSize: "13px",
                  transition: "color 0.15s ease",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom clock */}
      <div className="px-5 pb-5 pt-4">
        <div
          className="h-px w-full mb-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
        <div className="text-center">
          <div
            className="tabular-nums text-white font-bold"
            style={{
              fontSize: "18px",
              fontFamily: "'JetBrains Mono','SF Mono', monospace",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "1px",
              textShadow: "0 0 20px rgba(0,210,138,0.12)",
            }}
          >
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div
            className="mt-1"
            style={{ fontSize: "11px", color: "#333" }}
          >
            {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </div>
        </div>
      </div>
    </aside>
  );
}
