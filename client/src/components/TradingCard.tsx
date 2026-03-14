import type { ReactNode } from "react";

interface TradingCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function TradingCard({ title, subtitle, children, className = "", headerActions }: TradingCardProps) {
  return (
    <div
      className={`rounded-2xl relative overflow-hidden ${className}`}
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="px-5 py-4">
        {title && (
          <div className="flex justify-between items-center gap-2.5 mb-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-white tracking-wide">{title}</div>
              {subtitle && <div className="text-xs text-[#444] mt-0.5">{subtitle}</div>}
            </div>
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
