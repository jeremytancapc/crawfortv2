"use client";

import { useMemo } from "react";
import { buildMockLeads } from "@/lib/airconnect/mock-data";
import { AirConnectProvider, useAirConnect } from "./airconnect-store";
import { TopBar } from "./components/top-bar";
import { QueueView } from "./components/queue-view";
import { PipelineView } from "./components/pipeline-view";
import { TableView } from "./components/table-view";
import { LeadPanel } from "./components/lead-panel";
import { ToastStack } from "./components/undo-toast";

function WorkspaceShell() {
  const { state } = useAirConnect();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <main className="min-h-0 flex-1 bg-[var(--surface-canvas)]">
        {state.activeView === "queue" && <QueueView />}
        {state.activeView === "pipeline" && <PipelineView />}
        {state.activeView === "table" && <TableView />}
      </main>
      {state.activeView !== "queue" && <LeadPanel />}
      <ToastStack />
    </div>
  );
}

/**
 * Top-level client entry for /airconnect. Mock leads are generated once on
 * mount (client-only - see airconnect-loader.tsx) so the same in-memory
 * dataset backs every view for the lifetime of the session.
 */
export function Workspace() {
  const leads = useMemo(() => buildMockLeads(), []);

  return (
    <AirConnectProvider leads={leads}>
      <WorkspaceShell />
    </AirConnectProvider>
  );
}
