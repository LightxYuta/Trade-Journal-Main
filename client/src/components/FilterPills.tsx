import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Check } from "lucide-react";

interface FilterPillsProps {
  options: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterPills({ options, activeId, onChange }: FilterPillsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLabel = options.find(o => o.id === activeId)?.label;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#666] hover:text-white transition-colors"
        style={{ border: "1px solid transparent" }}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>{activeLabel || "Filter"}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-lg z-20 overflow-hidden">
          {options.map(option => {
            const isActive = activeId === option.id;
            return (
              <button
                key={option.id}
                onClick={() => { onChange(option.id); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#141414] transition-colors"
                style={{ color: isActive ? "#ffffff" : "#666" }}
              >
                {option.label}
                {isActive && <Check className="w-3 h-3" style={{ color: "#00d28a" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
