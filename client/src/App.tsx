import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { TradeProvider } from "@/contexts/TradeContext";
import { YearFilterProvider } from "@/contexts/YearFilterContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import Analytics from "@/pages/Analytics";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";
import LossTracker from "@/pages/LossTracker";
import Mistakes from "@/pages/Mistakes";
import Settings from "@/pages/Settings";
import Protocols from "@/pages/Protocols";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/Auth";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <ThemeProvider>
      <TradeProvider>
        <YearFilterProvider>
          <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
            <Sidebar minimized={sidebarMinimized} setMinimized={setSidebarMinimized} />
            <main className="flex-1 overflow-y-auto transition-all duration-200">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/trades" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 900, margin: '0 auto', width: '100%' } : {}}>
                    <Trades />
                  </div>
                )} />
                <Route path="/analytics" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 1100, margin: '0 auto', width: '100%' } : {}}>
                    <Analytics />
                  </div>
                )} />
                <Route path="/advanced" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 1100, margin: '0 auto', width: '100%' } : {}}>
                    <AdvancedAnalytics />
                  </div>
                )} />
                <Route path="/loss-tracker" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 1100, margin: '0 auto', width: '100%' } : {}}>
                    <LossTracker />
                  </div>
                )} />
                <Route path="/mistakes" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 1100, margin: '0 auto', width: '100%' } : {}}>
                    <Mistakes />
                  </div>
                )} />
                <Route path="/protocols" component={Protocols} />
                <Route path="/settings" component={() => (
                  <div style={sidebarMinimized ? { maxWidth: 1100, margin: '0 auto', width: '100%' } : {}}>
                    <Settings />
                  </div>
                )} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
          <Toaster />
        </YearFilterProvider>
      </TradeProvider>
    </ThemeProvider>
  );
}

export default App;
