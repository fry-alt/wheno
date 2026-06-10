import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { StartParamHandler } from "@/components/friends/start-param-handler";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <StartParamHandler />
      {children}
      <BottomNav />
    </div>
  );
}
