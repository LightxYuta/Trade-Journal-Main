interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  valueColor?: "default" | "positive" | "negative" | "gold" | "blue" | "pink";
}

export function StatCard({ label, value, subtext, valueColor = "default" }: StatCardProps) {
  const getValueColorClass = () => {
    switch (valueColor) {
      case "positive":
        return "text-[#00d28a]";
      case "negative":
        return "text-[#ff4f4f]";
      case "gold":
        return "text-[#ffd76e]";
      case "blue":
        return "text-[#4fc3f7]";
      case "pink":
        return "text-[#ff9ece]";
      default:
        return "text-white";
    }
  };

  return (
    <div 
      className="stat-card-trading"
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="text-[0.74rem] text-[#b8b8b8]">{label}</div>
      <div className={`text-base font-semibold ${getValueColorClass()}`}>{value}</div>
      {subtext && <div className="text-[0.7rem] text-[#b8b8b8]">{subtext}</div>}
    </div>
  );
}
