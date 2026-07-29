"use client";

import { useState } from "react";
import type { RetailTab } from "./types";
import { RetailProvider } from "./retail-store";
import { RetailHeader } from "./retail-header";
import { QueueTab } from "./queue-tab";
import { ApplicationsTab } from "./applications-tab";
import { LoansTab } from "./loans-tab";

export function RetailView() {
  const [activeTab, setActiveTab] = useState<RetailTab>("queue");

  return (
    <RetailProvider>
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
        <RetailHeader activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "queue"        && <QueueTab />}
          {activeTab === "applications" && (
            <div className="h-full overflow-hidden">
              <ApplicationsTab />
            </div>
          )}
          {activeTab === "loans"        && <LoansTab />}
        </main>
      </div>
    </RetailProvider>
  );
}
