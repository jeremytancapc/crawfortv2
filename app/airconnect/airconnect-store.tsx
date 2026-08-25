"use client";

import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type {
  AgentId,
  ActivityCounts,
  CallOutcome,
  CloseReason,
  Lead,
  LeadSource,
  LeadStatus,
  LeadTags,
  QualifyingReasonFilter,
  QueueTypeFilter,
  Toast,
  ViewMode,
} from "@/lib/airconnect/types";
import { AGENTS } from "@/lib/airconnect/mock-data";
import { ACTIVE_QUEUE_STATUSES, CLOSE_REASON_LABELS } from "@/lib/airconnect/types";
import { applyCallOutcome, CALL_OUTCOME_LABELS, getDueBucket, toDateKey } from "@/lib/airconnect/helpers";

// ─── State ────────────────────────────────────────────────────────────────────

export interface AirConnectState {
  leads: Lead[];
  currentAgentId: AgentId;
  activeView: ViewMode;
  search: string;
  statusFilter: LeadStatus | "all";
  sourceFilter: LeadSource | "all";
  queueTypeFilter: QueueTypeFilter;
  /** Drill-down within the "qualifying" chip; only meaningful when queueTypeFilter is "qualifying". */
  qualifyingReasonFilter: QualifyingReasonFilter;
  selectedLeadId: string | null;
  /** Calendar day the queue is showing, local YYYY-MM-DD. */
  queueDate: string;
  toasts: Toast[];
  activityCounts: Record<AgentId, ActivityCounts>;
  /** Lead ids that were due today for each agent at initial load - fixed baseline for the progress ring. */
  dailyBaseline: Record<AgentId, string[]>;
}

function emptyCounts(): ActivityCounts {
  return { calls: 0, notes: 0, messages: 0, booked: 0 };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SWITCH_AGENT"; agentId: AgentId }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SET_SEARCH"; query: string }
  | { type: "SET_STATUS_FILTER"; status: LeadStatus | "all" }
  | { type: "SET_SOURCE_FILTER"; source: LeadSource | "all" }
  | { type: "SET_QUEUE_TYPE_FILTER"; filter: QueueTypeFilter }
  | { type: "SET_QUALIFYING_REASON_FILTER"; reason: QualifyingReasonFilter }
  | { type: "SELECT_LEAD"; leadId: string | null }
  | { type: "SET_QUEUE_DATE"; dateKey: string }
  | { type: "SET_CALL_OUTCOME"; leadId: string; outcome: CallOutcome }
  | { type: "ADD_NOTE"; leadId: string; text: string }
  | { type: "SEND_MESSAGE"; leadId: string; templateLabel: string; text: string }
  | { type: "BOOK_APPOINTMENT"; leadId: string; dateISO: string; timeLabel: string }
  | { type: "SNOOZE_LEAD"; leadId: string; until: string; label: string }
  | { type: "MARK_DONE"; leadId: string }
  | { type: "SET_STATUS"; leadId: string; status: LeadStatus }
  | { type: "SET_CLOSE_REASON"; leadId: string; reason: CloseReason }
  | { type: "SET_LEAD_TAGS"; leadId: string; patch: Partial<LeadTags> }
  | { type: "UNDO_TOAST"; toastId: string }
  | { type: "DISMISS_TOAST"; toastId: string };

let toastCounter = 0;
function makeToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

let noteCounter = 0;
function makeNoteId(): string {
  noteCounter += 1;
  return `note-${Date.now()}-${noteCounter}`;
}

function pushToast(toasts: Toast[], toast: Omit<Toast, "id" | "createdAt">): Toast[] {
  return [...toasts, { ...toast, id: makeToastId(), createdAt: Date.now() }];
}

function updateLead(leads: Lead[], leadId: string, updater: (lead: Lead) => Lead): Lead[] {
  return leads.map((l) => (l.id === leadId ? updater(l) : l));
}

function nextVisibleQueueLeadId(state: AirConnectState, excludeId: string, now: Date): string | null {
  const viewingToday = state.queueDate === toDateKey(now);
  const remaining = state.leads.filter((lead) => {
    if (lead.id === excludeId) return false;
    if (lead.agentId !== state.currentAgentId) return false;
    if (!ACTIVE_QUEUE_STATUSES.includes(lead.status)) return false;
    if (!lead.followUpAt) return false;
    if (viewingToday) {
      const bucket = getDueBucket(lead, now);
      return bucket === "today";
    }
    return toDateKey(new Date(lead.followUpAt)) === state.queueDate;
  });
  remaining.sort((a, b) => new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime());
  return remaining[0]?.id ?? null;
}

function bumpCount(state: AirConnectState, agentId: AgentId, key: keyof ActivityCounts): Record<AgentId, ActivityCounts> {
  const current = state.activityCounts[agentId] ?? emptyCounts();
  return { ...state.activityCounts, [agentId]: { ...current, [key]: current[key] + 1 } };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function airconnectReducer(state: AirConnectState, action: Action): AirConnectState {
  const now = new Date();

  switch (action.type) {
    case "SWITCH_AGENT":
      return { ...state, currentAgentId: action.agentId, selectedLeadId: null, queueDate: toDateKey(now) };

    case "SET_VIEW":
      return { ...state, activeView: action.view, selectedLeadId: action.view === "queue" ? state.selectedLeadId : null };

    case "SET_SEARCH":
      return { ...state, search: action.query };

    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.status };

    case "SET_SOURCE_FILTER":
      return { ...state, sourceFilter: action.source };

    case "SET_QUEUE_TYPE_FILTER":
      return {
        ...state,
        queueTypeFilter: action.filter,
        qualifyingReasonFilter: action.filter === "qualifying" ? state.qualifyingReasonFilter : "all",
      };

    case "SET_QUALIFYING_REASON_FILTER":
      return { ...state, queueTypeFilter: "qualifying", qualifyingReasonFilter: action.reason };

    case "SELECT_LEAD":
      return { ...state, selectedLeadId: action.leadId };

    case "SET_QUEUE_DATE":
      return { ...state, queueDate: action.dateKey };

    case "SET_CALL_OUTCOME": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;
      const effect = applyCallOutcome(action.outcome, now, lead.status);

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        status: effect.status ?? l.status,
        followUpAt: effect.followUpAt,
        updatedAt: now.toISOString(),
        notes: [
          { id: makeNoteId(), kind: "call", text: effect.noteText, authorId: state.currentAgentId, createdAt: now.toISOString() },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        activityCounts: bumpCount(state, state.currentAgentId, "calls"),
        toasts: pushToast(state.toasts, {
          kind: "info",
          message: `${lead.name.split(" ")[0]}: logged "${CALL_OUTCOME_LABELS[action.outcome]}"`,
        }),
      };
    }

    case "ADD_NOTE": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead || !action.text.trim()) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        updatedAt: now.toISOString(),
        notes: [
          { id: makeNoteId(), kind: "note", text: action.text.trim(), authorId: state.currentAgentId, createdAt: now.toISOString() },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        activityCounts: bumpCount(state, state.currentAgentId, "notes"),
        toasts: pushToast(state.toasts, { kind: "info", message: `Note added for ${lead.name.split(" ")[0]}` }),
      };
    }

    case "SEND_MESSAGE": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        updatedAt: now.toISOString(),
        notes: [
          {
            id: makeNoteId(),
            kind: "message",
            text: `Sent "${action.templateLabel}": ${action.text}`,
            authorId: state.currentAgentId,
            createdAt: now.toISOString(),
          },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        activityCounts: bumpCount(state, state.currentAgentId, "messages"),
        toasts: pushToast(state.toasts, { kind: "info", message: `Message sent to ${lead.name.split(" ")[0]}` }),
      };
    }

    case "BOOK_APPOINTMENT": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const dayLabel = new Date(action.dateISO).toLocaleDateString("en-SG", { day: "numeric", month: "short" });

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        status: "pending-booking",
        appointment: { id: `appt-${Date.now()}`, dateISO: action.dateISO, timeLabel: action.timeLabel, createdAt: now.toISOString() },
        followUpAt: action.dateISO,
        updatedAt: now.toISOString(),
        notes: [
          {
            id: makeNoteId(),
            kind: "booking",
            text: `Appointment booked for ${dayLabel}, ${action.timeLabel}.`,
            authorId: state.currentAgentId,
            createdAt: now.toISOString(),
          },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        activityCounts: bumpCount(state, state.currentAgentId, "booked"),
        toasts: pushToast(state.toasts, { kind: "booking", message: `Booked ${lead.name.split(" ")[0]} for ${dayLabel}, ${action.timeLabel}` }),
      };
    }

    case "SNOOZE_LEAD": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        followUpAt: action.until,
        updatedAt: now.toISOString(),
        notes: [
          { id: makeNoteId(), kind: "snooze", text: `Snoozed to ${action.label}.`, authorId: state.currentAgentId, createdAt: now.toISOString() },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        selectedLeadId: state.selectedLeadId === lead.id ? nextVisibleQueueLeadId({ ...state, leads }, lead.id, now) : state.selectedLeadId,
        toasts: pushToast(state.toasts, {
          kind: "snooze",
          message: `Moved ${lead.name.split(" ")[0]} to ${action.label} — use the date strip to find them`,
          undoSnapshot: lead,
        }),
      };
    }

    case "MARK_DONE": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        status: "done",
        followUpAt: null,
        updatedAt: now.toISOString(),
        notes: [{ id: makeNoteId(), kind: "status", text: "Marked as done.", authorId: state.currentAgentId, createdAt: now.toISOString() }, ...l.notes],
      }));

      return {
        ...state,
        leads,
        selectedLeadId: state.selectedLeadId === lead.id ? null : state.selectedLeadId,
        toasts: pushToast(state.toasts, { kind: "done", message: `Cleared ${lead.name.split(" ")[0]} - marked done`, undoSnapshot: lead }),
      };
    }

    case "SET_STATUS": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        status: action.status,
        updatedAt: now.toISOString(),
        notes: [
          { id: makeNoteId(), kind: "status", text: `Status changed to ${action.status.replace(/-/g, " ")}.`, authorId: state.currentAgentId, createdAt: now.toISOString() },
          ...l.notes,
        ],
      }));

      return { ...state, leads };
    }

    case "SET_CLOSE_REASON": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const label = CLOSE_REASON_LABELS[action.reason];
      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        status: "not-eligible",
        closeReason: action.reason,
        followUpAt: null,
        updatedAt: now.toISOString(),
        notes: [
          { id: makeNoteId(), kind: "status", text: `Status changed to not eligible (${label}).`, authorId: state.currentAgentId, createdAt: now.toISOString() },
          ...l.notes,
        ],
      }));

      return {
        ...state,
        leads,
        selectedLeadId: state.selectedLeadId === lead.id ? null : state.selectedLeadId,
        toasts: pushToast(state.toasts, { kind: "status", message: `${lead.name.split(" ")[0]} closed - ${label}`, undoSnapshot: lead }),
      };
    }

    case "SET_LEAD_TAGS": {
      const lead = state.leads.find((l) => l.id === action.leadId);
      if (!lead) return state;

      const leads = updateLead(state.leads, lead.id, (l) => ({
        ...l,
        tags: { ...l.tags, ...action.patch },
        updatedAt: now.toISOString(),
      }));

      return { ...state, leads };
    }

    case "UNDO_TOAST": {
      const toast = state.toasts.find((t) => t.id === action.toastId);
      if (!toast) return state;

      let leads = state.leads;
      if (toast.undoSnapshot) {
        leads = updateLead(state.leads, toast.undoSnapshot.id, () => toast.undoSnapshot as Lead);
      }

      return { ...state, leads, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
    }

    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AirConnectContextValue {
  state: AirConnectState;
  switchAgent: (agentId: AgentId) => void;
  setView: (view: ViewMode) => void;
  setSearch: (query: string) => void;
  setStatusFilter: (status: LeadStatus | "all") => void;
  setSourceFilter: (source: LeadSource | "all") => void;
  setQueueTypeFilter: (filter: QueueTypeFilter) => void;
  setQualifyingReasonFilter: (reason: QualifyingReasonFilter) => void;
  selectLead: (leadId: string | null) => void;
  setQueueDate: (dateKey: string) => void;
  setCallOutcome: (leadId: string, outcome: CallOutcome) => void;
  addNote: (leadId: string, text: string) => void;
  sendMessage: (leadId: string, templateLabel: string, text: string) => void;
  bookAppointment: (leadId: string, dateISO: string, timeLabel: string) => void;
  snoozeLead: (leadId: string, until: string, label: string) => void;
  markDone: (leadId: string) => void;
  setStatus: (leadId: string, status: LeadStatus) => void;
  setCloseReason: (leadId: string, reason: CloseReason) => void;
  setLeadTags: (leadId: string, patch: Partial<LeadTags>) => void;
  undoToast: (toastId: string) => void;
  dismissToast: (toastId: string) => void;
}

const AirConnectContext = createContext<AirConnectContextValue | null>(null);

function buildInitialState(leads: Lead[]): AirConnectState {
  const now = new Date();
  const dailyBaseline: Record<AgentId, string[]> = { "agent-a": [], "agent-b": [], "agent-c": [] };
  const activityCounts: Record<AgentId, ActivityCounts> = {
    "agent-a": emptyCounts(),
    "agent-b": emptyCounts(),
    "agent-c": emptyCounts(),
  };

  leads.forEach((lead) => {
    const bucket = getDueBucket(lead, now);
    if (bucket === "today") {
      dailyBaseline[lead.agentId].push(lead.id);
    }
  });

  return {
    leads,
    currentAgentId: "agent-a",
    activeView: "queue",
    search: "",
    statusFilter: "all",
    sourceFilter: "all",
    queueTypeFilter: "all",
    qualifyingReasonFilter: "all",
    selectedLeadId: null,
    queueDate: toDateKey(now),
    toasts: [],
    activityCounts,
    dailyBaseline,
  };
}

export function AirConnectProvider({ leads, children }: { leads: Lead[]; children: React.ReactNode }) {
  const [state, dispatch] = useReducer(airconnectReducer, leads, buildInitialState);

  const switchAgent = useCallback((agentId: AgentId) => dispatch({ type: "SWITCH_AGENT", agentId }), []);
  const setView = useCallback((view: ViewMode) => dispatch({ type: "SET_VIEW", view }), []);
  const setSearch = useCallback((query: string) => dispatch({ type: "SET_SEARCH", query }), []);
  const setStatusFilter = useCallback((status: LeadStatus | "all") => dispatch({ type: "SET_STATUS_FILTER", status }), []);
  const setSourceFilter = useCallback((source: LeadSource | "all") => dispatch({ type: "SET_SOURCE_FILTER", source }), []);
  const setQueueTypeFilter = useCallback((filter: QueueTypeFilter) => dispatch({ type: "SET_QUEUE_TYPE_FILTER", filter }), []);
  const setQualifyingReasonFilter = useCallback(
    (reason: QualifyingReasonFilter) => dispatch({ type: "SET_QUALIFYING_REASON_FILTER", reason }),
    []
  );
  const selectLead = useCallback((leadId: string | null) => dispatch({ type: "SELECT_LEAD", leadId }), []);
  const setQueueDate = useCallback((dateKey: string) => dispatch({ type: "SET_QUEUE_DATE", dateKey }), []);
  const setCallOutcome = useCallback((leadId: string, outcome: CallOutcome) => dispatch({ type: "SET_CALL_OUTCOME", leadId, outcome }), []);
  const addNote = useCallback((leadId: string, text: string) => dispatch({ type: "ADD_NOTE", leadId, text }), []);
  const sendMessage = useCallback((leadId: string, templateLabel: string, text: string) => dispatch({ type: "SEND_MESSAGE", leadId, templateLabel, text }), []);
  const bookAppointment = useCallback((leadId: string, dateISO: string, timeLabel: string) => dispatch({ type: "BOOK_APPOINTMENT", leadId, dateISO, timeLabel }), []);
  const snoozeLead = useCallback((leadId: string, until: string, label: string) => dispatch({ type: "SNOOZE_LEAD", leadId, until, label }), []);
  const markDone = useCallback((leadId: string) => dispatch({ type: "MARK_DONE", leadId }), []);
  const setStatus = useCallback((leadId: string, status: LeadStatus) => dispatch({ type: "SET_STATUS", leadId, status }), []);
  const setCloseReason = useCallback((leadId: string, reason: CloseReason) => dispatch({ type: "SET_CLOSE_REASON", leadId, reason }), []);
  const setLeadTags = useCallback((leadId: string, patch: Partial<LeadTags>) => dispatch({ type: "SET_LEAD_TAGS", leadId, patch }), []);
  const undoToast = useCallback((toastId: string) => dispatch({ type: "UNDO_TOAST", toastId }), []);
  const dismissToast = useCallback((toastId: string) => dispatch({ type: "DISMISS_TOAST", toastId }), []);

  const value = useMemo<AirConnectContextValue>(
    () => ({
      state,
      switchAgent,
      setView,
      setSearch,
      setStatusFilter,
      setSourceFilter,
      setQueueTypeFilter,
      setQualifyingReasonFilter,
      selectLead,
      setQueueDate,
      setCallOutcome,
      addNote,
      sendMessage,
      bookAppointment,
      snoozeLead,
      markDone,
      setStatus,
      setCloseReason,
      setLeadTags,
      undoToast,
      dismissToast,
    }),
    [state, switchAgent, setView, setSearch, setStatusFilter, setSourceFilter, setQueueTypeFilter, setQualifyingReasonFilter, selectLead, setQueueDate, setCallOutcome, addNote, sendMessage, bookAppointment, snoozeLead, markDone, setStatus, setCloseReason, setLeadTags, undoToast, dismissToast]
  );

  return <AirConnectContext.Provider value={value}>{children}</AirConnectContext.Provider>;
}

export function useAirConnect(): AirConnectContextValue {
  const ctx = useContext(AirConnectContext);
  if (!ctx) throw new Error("useAirConnect must be used inside <AirConnectProvider>");
  return ctx;
}

export function useAgents() {
  return AGENTS;
}
