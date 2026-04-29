import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeMode = 'color' | 'mono';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'color',
  toggleTheme: () => {},
});

const THEME_KEY = 'tj_theme_v1';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;

  // Set data-theme attribute — used by CSS overrides in index.css
  root.setAttribute('data-theme', mode);

  if (mode === 'mono') {
    root.style.setProperty('--t-win',         '#e8e8e8');
    root.style.setProperty('--t-win-bg',      'rgba(232,232,232,0.06)');
    root.style.setProperty('--t-win-border',  'rgba(232,232,232,0.12)');
    root.style.setProperty('--t-loss',        '#c0786a');
    root.style.setProperty('--t-loss-bg',     'rgba(192,120,106,0.08)');
    root.style.setProperty('--t-loss-border', 'rgba(192,120,106,0.18)');
    root.style.setProperty('--t-be',          '#888888');
    root.style.setProperty('--t-be-bg',       'rgba(136,136,136,0.08)');
    root.style.setProperty('--t-be-border',   'rgba(136,136,136,0.15)');
    root.style.setProperty('--t-accent',      '#ffffff');
    root.style.setProperty('--t-accent-bg',   'rgba(255,255,255,0.06)');
    root.style.setProperty('--t-gold',        '#aaaaaa');
    root.style.setProperty('--t-gold-bg',     'rgba(170,170,170,0.06)');
    root.style.setProperty('--t-chart-up',    '#d4d4d4');
    root.style.setProperty('--t-chart-down',  '#c0786a');
    root.style.setProperty('--t-chart-line',  '#888888');
    root.style.setProperty('--t-nav-active',  '#ffffff');
    // Override legacy accent vars used by badge CSS classes
    root.style.setProperty('--accent-green',  '#e8e8e8');
    root.style.setProperty('--accent-red',    '#c0786a');
    root.style.setProperty('--accent-gold',   '#aaaaaa');
  } else {
    root.style.setProperty('--t-win',         '#00d28a');
    root.style.setProperty('--t-win-bg',      'rgba(0,210,138,0.08)');
    root.style.setProperty('--t-win-border',  'rgba(0,210,138,0.18)');
    root.style.setProperty('--t-loss',        '#ff4f4f');
    root.style.setProperty('--t-loss-bg',     'rgba(255,79,79,0.08)');
    root.style.setProperty('--t-loss-border', 'rgba(255,79,79,0.18)');
    root.style.setProperty('--t-be',          '#ffd76e');
    root.style.setProperty('--t-be-bg',       'rgba(255,215,110,0.08)');
    root.style.setProperty('--t-be-border',   'rgba(255,215,110,0.15)');
    root.style.setProperty('--t-accent',      '#00d28a');
    root.style.setProperty('--t-accent-bg',   'rgba(0,210,138,0.08)');
    root.style.setProperty('--t-gold',        '#ffd76e');
    root.style.setProperty('--t-gold-bg',     'rgba(255,215,110,0.08)');
    root.style.setProperty('--t-chart-up',    '#00d28a');
    root.style.setProperty('--t-chart-down',  '#ff4f4f');
    root.style.setProperty('--t-chart-line',  '#00d28a');
    root.style.setProperty('--t-nav-active',  '#00d28a');
    root.style.setProperty('--accent-green',  '#00d28a');
    root.style.setProperty('--accent-red',    '#ff4f4f');
    root.style.setProperty('--accent-gold',   '#ffd76e');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'color'; }
    catch { return 'color'; }
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => { applyTheme(theme); }, []);

  const toggleTheme = () => setTheme(t => t === 'color' ? 'mono' : 'color');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
