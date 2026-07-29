"use client";

import { useState } from "react";
import type { RetailTab } from "./types";
import { RetailProvider } from "./retail-store";
import { RetailHeader } from "./retail-header";
import { RetailSettings } from "./retail-settings";
import { QueueTab } from "./queue-tab";
import { ApplicationsTab } from "./applications-tab";
import { LoansTab } from "./loans-tab";

export function RetailView() {
  const [activeTab, setActiveTab] = useState<RetailTab>("queue");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleTabChange = (tab: RetailTab) => {
    setIsSettingsOpen(false);
    setActiveTab(tab);
  };

  return (
    <RetailProvider>
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
        <RetailHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isSettingsOpen={isSettingsOpen}
          onToggleSettings={() => setIsSettingsOpen((open) => !open)}
        />

        <main className="flex-1 min-h-0 overflow-hidden">
          {isSettingsOpen ? (
            <RetailSettings onBack={() => setIsSettingsOpen(false)} />
          ) : (
            <>
              {activeTab === "queue" && <QueueTab />}
              {activeTab === "applications" && (
                <div className="h-full overflow-hidden">
                  <ApplicationsTab />
                </div>
              )}
              {activeTab === "loans" && (
                <LoansTab onNavigateToQueue={() => handleTabChange("queue")} />
              )}
            </>
          )}
        </main>
      </div>
    </RetailProvider>
  );
}
