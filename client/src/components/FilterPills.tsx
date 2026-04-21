interface FilterPillsProps {
  options: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterPills({ options, activeId, onChange }: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isActive = activeId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            data-testid={`filter-${option.id}`}
            className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
            style={{
              transition: "all 0.18s ease",
              border: isActive ? "1px solid rgba(0,210,138,0.4)" : "1px solid rgba(60,60,60,0.8)",
              background: isActive ? "rgba(0,210,138,0.08)" : "rgba(10,10,10,0.96)",
              color: isActive ? "#ffffff" : "#666666",
              cursor: "pointer",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color = "#aaaaaa";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(100,100,100,0.8)";
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color = "#666666";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(60,60,60,0.8)";
              }
            }}
          >
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d28a]" style={{ boxShadow: "0 0 6px rgba(0,210,138,0.6)" }} />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
