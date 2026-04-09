import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { TradeProvider } from "@/contexts/TradeContext";
import { YearFilterProvider } from "@/contexts/YearFilterContext";
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
    <TradeProvider>
      <YearFilterProvider>
        <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/trades" component={Trades} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/advanced" component={AdvancedAnalytics} />
              <Route path="/loss-tracker" component={LossTracker} />
              <Route path="/mistakes" component={Mistakes} />
              <Route path="/protocols" component={Protocols} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <Toaster />
      </YearFilterProvider>
    </TradeProvider>
  );
}

export default App;