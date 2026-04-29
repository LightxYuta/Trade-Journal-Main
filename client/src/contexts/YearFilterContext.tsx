import React, { createContext, useContext, useState } from "react";

export type YearFilter = number | "all";

interface YearFilterContextProps {
  year: YearFilter;
  setYear: (year: YearFilter) => void;
}

const YearFilterContext = createContext<YearFilterContextProps | undefined>(undefined);

export const YearFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYearState] = useState<YearFilter>(() => {
    const stored = localStorage.getItem("tj_year_filter");
    if (stored === "all") return "all";
    if (stored && !isNaN(Number(stored))) return Number(stored);
    return currentYear;
  });

  const setYear = (y: YearFilter) => {
    setYearState(y);
    localStorage.setItem("tj_year_filter", y.toString());
  };

  return (
    <YearFilterContext.Provider value={{ year, setYear }}>
      {children}
    </YearFilterContext.Provider>
  );
};

export function useYearFilter() {
  const ctx = useContext(YearFilterContext);
  if (!ctx) throw new Error("useYearFilter must be used within a YearFilterProvider");
  return ctx;
}
