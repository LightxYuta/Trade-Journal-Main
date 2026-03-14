import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TradeProvider } from "@/contexts/TradeContext";
import { Sidebar } from "@/components/Sidebar";
import { YearFilterProvider } from "@/contexts/YearFilterContext";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import Analytics from "@/pages/Analytics";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";
import Settings from "@/pages/Settings";
import Mistakes from "./pages/Mistakes";
import LossTracker from "./pages/LossTracker";

function TradingJournalApp() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "trades":
        return <Trades />;
      case "analytics":
        return <Analytics />;
      case "mistakes":
        return <Mistakes />;
      case "lossTracker":
        return <LossTracker />;
      case "advanced":
        return <AdvancedAnalytics />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TradeProvider>
          <YearFilterProvider>
            <TradingJournalApp />
            <Toaster />
          </YearFilterProvider>
        </TradeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
