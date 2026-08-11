import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ImagePlus, Calendar as CalendarIcon, LayoutList } from "lucide-react";
import DayView from "./DayView";
import WeekView from "./WeekView";
import {
  loadMonthCover, setMonthCover, uploadMonthCoverImage,
  loadMonthData, dayVisualStateFromData,
  type MonthData, type DayVisualState,
} from "@/lib/planStorage";

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateStr(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

type View =
  | { level: 'year'; year: number }
  | { level: 'month'; year: number; month: number }
  | { level: 'week'; year: number; month: number; mondayDate: string }
  | { level: 'day'; date: string; returnTo: View };

// ─── Year view ────────────────────────────────────────────────────────────────

function YearView({ year, onOpenMonth, onChangeYear }: { year: number; onOpenMonth: (m: number) => void; onChangeYear: (y: number) => void }) {
  const [covers, setCovers] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(MONTH_NAMES.map((_, i) => loadMonthCover(year, i + 1))).then(results => {
      if (cancelled) return;
      const map: Record<number, string | null> = {};
      results.forEach((url, i) => { map[i + 1] = url; });
      setCovers(map);
    });
    return () => { cancelled = true; };
  }, [year]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onChangeYear(year - 1)} className="text-[#555] hover:text-white transition-colors text-sm">‹</button>
          <h2 className="text-lg font-semibold text-white">{year}</h2>
          <button onClick={() => onChangeYear(year + 1)} className="text-[#555] hover:text-white transition-colors text-sm">›</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {MONTH_NAMES.map((name, i) => {
          const month = i + 1;
          const cover = covers[month];
          return (
            <button key={month} onClick={() => onOpenMonth(month)}
              className="relative rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden aspect-[4/3] group hover:border-[#333] transition-colors">
              {cover ? (
                <img src={cover} alt={name} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
              ) : null}
              <div className="absolute inset-0 flex items-end p-3" style={{ background: cover ? 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8))' : 'none' }}>
                <span className="text-sm font-medium text-white">{name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  year, month, onBack, onOpenWeek, onOpenDay,
}: {
  year: number; month: number;
  onBack: () => void;
  onOpenWeek: (mondayDate: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const [mode, setMode] = useState<'calendar' | 'weeks'>('calendar');
  const [cover, setCover] = useState<string | null>(null);
  const [data, setData] = useState<MonthData | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMonthCover(year, month).then(setCover);
    loadMonthData(year, month).then(setData);
  }, [year, month]);

  const handleCoverFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadMonthCoverImage(file, year, month);
      await setMonthCover(year, month, url);
      setCover(url);
    } finally {
      setUploading(false);
    }
  };

  const lastDay = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const leadingBlanks = firstDow; // Sun-start grid

  // Group weekdays (Mon-Fri) into week buckets keyed by that week's Monday date
  const weekBuckets: string[] = [];
  {
    let cursor = new Date(year, month - 1, 1);
    // walk to the first Monday on/before the 1st
    while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);
    const lastOfMonth = new Date(year, month - 1, lastDay);
    while (cursor <= lastOfMonth) {
      weekBuckets.push(dateStr(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <h2 className="text-sm font-semibold text-white">{MONTH_NAMES[month - 1]} {year}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-[#555] hover:text-white hover:border-[#333] transition-colors disabled:opacity-40">
            <ImagePlus className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : cover ? 'Change cover' : 'Add cover'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); }} />
          <div className="flex items-center rounded-lg border border-[#1e1e1e] overflow-hidden">
            <button onClick={() => setMode('calendar')} className="p-1.5" style={{ background: mode === 'calendar' ? '#1a1a1a' : 'transparent', color: mode === 'calendar' ? '#fff' : '#555' }}>
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setMode('weeks')} className="p-1.5" style={{ background: mode === 'weeks' ? '#1a1a1a' : 'transparent', color: mode === 'weeks' ? '#fff' : '#555' }}>
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {cover && (
        <div className="rounded-xl overflow-hidden h-24 border border-[#1e1e1e]">
          <img src={cover} className="w-full h-full object-cover opacity-70" alt="" />
        </div>
      )}

      {mode === 'calendar' ? (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-xs text-[#333] text-center pb-1">{d}</div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: lastDay }, (_, i) => i + 1).map(d => {
            const ds = dateStr(year, month, d);
            const state: DayVisualState = data ? dayVisualStateFromData(ds, data) : 'no-plan-no-trade';
            const style = state === 'planless-trading'
              ? { bg: '#1a0a0a', border: '#3a1414', text: '#ff8080' }
              : state === 'normal'
              ? { bg: '#0d0d0d', border: '#1e1e1e', text: '#ccc' }
              : { bg: '#080808', border: '#151515', text: '#333' };
            return (
              <button key={d} onClick={() => onOpenDay(ds)}
                className="aspect-square rounded-lg border flex items-center justify-center text-xs font-medium hover:border-[#333] transition-colors"
                style={{ background: style.bg, borderColor: style.border, color: style.text }}>
                {d}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {weekBuckets.map(monday => (
            <button key={monday} onClick={() => onOpenWeek(monday)}
              className="w-full text-left rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3 hover:border-[#333] transition-colors">
              <span className="text-sm text-white">Week of {monday}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main container ────────────────────────────────────────────────────────────

export default function DailyPlan() {
  const t = todayParts();
  const [view, setView] = useState<View>({ level: 'year', year: t.y });

  return (
    <div className="min-h-screen p-8" style={{ background: '#0a0a0a' }}>
      {view.level === 'day' && (
        <DayView date={view.date} onBack={() => setView(view.returnTo)} />
      )}
      {view.level === 'week' && (
        <WeekView
          mondayDate={view.mondayDate}
          monthData={null}
          onBack={() => setView({ level: 'month', year: view.year, month: view.month })}
          onOpenDay={date => setView({ level: 'day', date, returnTo: view })}
        />
      )}
      {view.level === 'month' && (
        <MonthView
          year={view.year}
          month={view.month}
          onBack={() => setView({ level: 'year', year: view.year })}
          onOpenWeek={mondayDate => setView({ level: 'week', year: view.year, month: view.month, mondayDate })}
          onOpenDay={date => setView({ level: 'day', date, returnTo: view })}
        />
      )}
      {view.level === 'year' && (
        <YearView
          year={view.year}
          onOpenMonth={month => setView({ level: 'month', year: view.year, month })}
          onChangeYear={year => setView({ level: 'year', year })}
        />
      )}
    </div>
  );
}
