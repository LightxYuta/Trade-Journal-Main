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
            className="filter-pill"
            style={{
              borderWidth: isActive ? "1.5px" : "1px",
              borderColor: isActive ? "#a78bfa99" : "rgba(90, 90, 90, 0.9)", // 60% opacity
              background: isActive 
                ? "radial-gradient(circle at top left, rgba(167, 139, 250, 0.06), rgba(10, 10, 10, 0.98))"
                : "rgba(10, 10, 10, 0.96)",
              color: isActive ? "#ffffff" : "#b8b8b8",
              boxShadow: isActive ? "0 0 6px 1px #a78bfa33" : "none", // 60% opacity
            }}
          >
            <span 
              className="w-1.5 h-1.5 rounded-full transition-all duration-150"
              style={{
                background: "#a78bfa99",
                boxShadow: isActive ? "0 0 8px #a78bfa33" : "none",
                opacity: isActive ? 1 : 0,
                transform: isActive ? "scale(1)" : "scale(0.3)",
              }}
            />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
