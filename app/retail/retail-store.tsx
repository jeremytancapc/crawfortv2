"use client";

import React, { createContext, useContext, useReducer, useCallback } from "react";
import type { RetailCustomer, Station, AppointmentType } from "./types";
import { buildInitialCustomers, buildInitialStations } from "./mock-data";

// ─── State ────────────────────────────────────────────────────────────────────

export interface RetailState {
  customers: RetailCustomer[];
  stations: Station[];
  /** Currently selected customer ID in the queue (for floor plan assignment) */
  selectedCustomerId: string | null;
  /** Station whose action sheet is open */
  activeStationId: string | null;
  /** Running counters for queue ticket generation */
  queueCounters: { L: number; C: number; P: number; D: number };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SELECT_CUSTOMER"; customerId: string | null }
  | { type: "OPEN_STATION_SHEET"; stationId: string | null }
  | { type: "ASSIGN_STATION"; customerId: string; stationId: string }
  | { type: "CUSTOMER_ARRIVED"; stationId: string }
  | { type: "COMPLETE_SERVICE"; stationId: string }
  | { type: "AUTO_ASSIGN"; customerId: string }
  | { type: "REASSIGN"; customerId: string }
  | { type: "REGISTER_WALK_IN"; customer: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "queuePosition"> };

// ─── Type → station mapping ───────────────────────────────────────────────────

function getStationTypesForAppt(apptType: AppointmentType): Station["type"][] {
  switch (apptType) {
    case "loan-application":  return ["kiosk"];
    case "customer-care":     return ["room"];
    case "cash-repayment":    return ["cashier"];
    case "cash-disbursement": return ["cashier"];
  }
}

function queuePrefixFor(apptType: AppointmentType): "L" | "C" | "P" | "D" {
  switch (apptType) {
    case "loan-application":  return "L";
    case "customer-care":     return "C";
    case "cash-repayment":    return "P";
    case "cash-disbursement": return "D";
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function retailReducer(state: RetailState, action: Action): RetailState {
  switch (action.type) {
    case "SELECT_CUSTOMER":
      return { ...state, selectedCustomerId: action.customerId, activeStationId: null };

    case "OPEN_STATION_SHEET":
      return { ...state, activeStationId: action.stationId, selectedCustomerId: null };

    case "ASSIGN_STATION": {
      const { customerId, stationId } = action;
      const customer = state.customers.find((c) => c.id === customerId);
      const station  = state.stations.find((s) => s.id === stationId);
      if (!customer || !station) return state;

      const isFree = station.status === "free";

      const updatedStations = state.stations.map((s) => {
        if (s.id !== stationId) return s;
        if (isFree) {
          return { ...s, status: "calling" as const, servingCustomerId: customerId };
        }
        return { ...s, queuedCustomerIds: [...s.queuedCustomerIds, customerId] };
      });

      const queuePos = isFree ? 0 : station.queuedCustomerIds.length + 1;

      const updatedCustomers = state.customers.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          status: isFree ? ("called" as const) : ("queued" as const),
          assignedStationId: stationId,
          queuePosition: queuePos,
        };
      });

      return {
        ...state,
        customers: updatedCustomers,
        stations: updatedStations,
        selectedCustomerId: null,
      };
    }

    case "CUSTOMER_ARRIVED": {
      const station = state.stations.find((s) => s.id === action.stationId);
      if (!station || station.status !== "calling") return state;

      const updatedStations = state.stations.map((s) =>
        s.id === action.stationId ? { ...s, status: "occupied" as const } : s
      );
      const updatedCustomers = state.customers.map((c) =>
        c.id === station.servingCustomerId
          ? { ...c, status: "serving" as const }
          : c
      );

      return { ...state, stations: updatedStations, customers: updatedCustomers, activeStationId: null };
    }

    case "COMPLETE_SERVICE": {
      const station = state.stations.find((s) => s.id === action.stationId);
      if (!station || station.status === "free") return state;

      const justFinished = station.servingCustomerId;
      const [nextId, ...remainingQueue] = station.queuedCustomerIds;

      const updatedStations = state.stations.map((s) => {
        if (s.id !== action.stationId) return s;
        if (nextId) {
          return {
            ...s,
            status: "calling" as const,
            servingCustomerId: nextId,
            queuedCustomerIds: remainingQueue,
          };
        }
        return {
          ...s,
          status: "free" as const,
          servingCustomerId: null,
          queuedCustomerIds: [],
        };
      });

      const updatedCustomers = state.customers.map((c) => {
        if (c.id === justFinished) return { ...c, status: "done" as const, assignedStationId: null, queuePosition: null };
        if (c.id === nextId)       return { ...c, status: "called" as const, queuePosition: 0 };
        if (station.queuedCustomerIds.includes(c.id) && c.id !== nextId) {
          const newPos = remainingQueue.indexOf(c.id) + 1;
          return { ...c, queuePosition: newPos };
        }
        return c;
      });

      return { ...state, stations: updatedStations, customers: updatedCustomers, activeStationId: null };
    }

    case "AUTO_ASSIGN": {
      const customer = state.customers.find((c) => c.id === action.customerId);
      if (!customer) return state;

      const targetTypes = getStationTypesForAppt(customer.appointmentType);
      const compatible  = state.stations.filter((s) => targetTypes.includes(s.type));

      const freeOne = compatible.find((s) => s.status === "free");
      const target  = freeOne ?? compatible.reduce((best, s) =>
        s.queuedCustomerIds.length < best.queuedCustomerIds.length ? s : best
      );

      if (!target) return state;

      return retailReducer(state, { type: "ASSIGN_STATION", customerId: action.customerId, stationId: target.id });
    }

    case "REASSIGN": {
      const customer = state.customers.find((c) => c.id === action.customerId);
      if (!customer) return state;
      // Already available — nothing to clear
      if (customer.status === "scheduled") {
        return { ...state, selectedCustomerId: customer.id };
      }

      const stationId = customer.assignedStationId;
      let updatedStations = state.stations;

      if (stationId) {
        const station = state.stations.find((s) => s.id === stationId);
        if (station) {
          const wasServing =
            station.servingCustomerId === customer.id &&
            (station.status === "calling" || station.status === "occupied");

          if (wasServing) {
            // Pull next from that station's queue, or free it
            const [nextId, ...remainingQueue] = station.queuedCustomerIds;
            updatedStations = state.stations.map((s) => {
              if (s.id !== stationId) return s;
              if (nextId) {
                return {
                  ...s,
                  status: "calling" as const,
                  servingCustomerId: nextId,
                  queuedCustomerIds: remainingQueue,
                };
              }
              return {
                ...s,
                status: "free" as const,
                servingCustomerId: null,
                queuedCustomerIds: [],
              };
            });
          } else {
            // Was only waiting in the queue — remove them
            const remainingQueue = station.queuedCustomerIds.filter((id) => id !== customer.id);
            updatedStations = state.stations.map((s) => {
              if (s.id !== stationId) return s;
              return { ...s, queuedCustomerIds: remainingQueue };
            });
          }
        }
      }

      const nextCalledId =
        stationId
          ? updatedStations.find((s) => s.id === stationId)?.servingCustomerId
          : null;
      const remainingAtStation =
        stationId
          ? (updatedStations.find((s) => s.id === stationId)?.queuedCustomerIds ?? [])
          : [];

      const updatedCustomers = state.customers.map((c) => {
        if (c.id === customer.id) {
          return {
            ...c,
            status: "scheduled" as const,
            assignedStationId: null,
            queuePosition: null,
          };
        }
        // Promote next in line if we freed a serving slot
        if (c.id === nextCalledId && c.status === "queued") {
          return { ...c, status: "called" as const, queuePosition: 0 };
        }
        // Recompute queue positions for remaining waiters
        if (remainingAtStation.includes(c.id)) {
          return { ...c, queuePosition: remainingAtStation.indexOf(c.id) + 1 };
        }
        return c;
      });

      return {
        ...state,
        customers: updatedCustomers,
        stations: updatedStations,
        selectedCustomerId: customer.id,
        activeStationId: null,
      };
    }

    case "REGISTER_WALK_IN": {
      const prefix = queuePrefixFor(action.customer.appointmentType);
      const newCount = state.queueCounters[prefix] + 1;
      const newQueueNumber = `${prefix}${String(newCount).padStart(3, "0")}`;

      const newCustomer: RetailCustomer = {
        ...action.customer,
        id: `cust-walkin-${Date.now()}`,
        queueNumber: newQueueNumber,
        status: "scheduled",
        assignedStationId: null,
        queuePosition: null,
      };

      return {
        ...state,
        customers: [...state.customers, newCustomer],
        queueCounters: { ...state.queueCounters, [prefix]: newCount },
        selectedCustomerId: newCustomer.id,
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface RetailContextValue {
  state: RetailState;
  selectCustomer: (id: string | null) => void;
  openStationSheet: (id: string | null) => void;
  assignStation: (customerId: string, stationId: string) => void;
  customerArrived: (stationId: string) => void;
  completeService: (stationId: string) => void;
  autoAssign: (customerId: string) => void;
  reassign: (customerId: string) => void;
  registerWalkIn: (customer: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "queuePosition">) => void;
}

const RetailContext = createContext<RetailContextValue | null>(null);

function buildInitialState(): RetailState {
  const customers = buildInitialCustomers();

  // Determine starting counters from seeded data
  const counters = { L: 0, C: 0, P: 0, D: 0 };
  customers.forEach((c) => {
    const prefix = queuePrefixFor(c.appointmentType);
    counters[prefix] = Math.max(counters[prefix], parseInt(c.queueNumber.slice(1), 10));
  });

  return {
    customers,
    stations: buildInitialStations(),
    selectedCustomerId: null,
    activeStationId: null,
    queueCounters: counters,
  };
}

export function RetailProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(retailReducer, undefined, buildInitialState);

  const selectCustomer   = useCallback((id: string | null) => dispatch({ type: "SELECT_CUSTOMER", customerId: id }), []);
  const openStationSheet = useCallback((id: string | null) => dispatch({ type: "OPEN_STATION_SHEET", stationId: id }), []);
  const assignStation    = useCallback((cId: string, sId: string) => dispatch({ type: "ASSIGN_STATION", customerId: cId, stationId: sId }), []);
  const customerArrived  = useCallback((sId: string) => dispatch({ type: "CUSTOMER_ARRIVED", stationId: sId }), []);
  const completeService  = useCallback((sId: string) => dispatch({ type: "COMPLETE_SERVICE", stationId: sId }), []);
  const autoAssign       = useCallback((cId: string) => dispatch({ type: "AUTO_ASSIGN", customerId: cId }), []);
  const reassign         = useCallback((cId: string) => dispatch({ type: "REASSIGN", customerId: cId }), []);
  const registerWalkIn   = useCallback((c: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "queuePosition">) =>
    dispatch({ type: "REGISTER_WALK_IN", customer: c }), []);

  return (
    <RetailContext.Provider value={{ state, selectCustomer, openStationSheet, assignStation, customerArrived, completeService, autoAssign, reassign, registerWalkIn }}>
      {children}
    </RetailContext.Provider>
  );
}

export function useRetail(): RetailContextValue {
  const ctx = useContext(RetailContext);
  if (!ctx) throw new Error("useRetail must be used inside <RetailProvider>");
  return ctx;
}

/** Convenience: get a single station by ID */
export function useStation(id: string): Station | undefined {
  const { state } = useRetail();
  return state.stations.find((s) => s.id === id);
}

/** Convenience: get customers assigned to a station (serving + queued) */
export function useStationCustomers(stationId: string): { serving: RetailCustomer | null; queued: RetailCustomer[] } {
  const { state } = useRetail();
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) return { serving: null, queued: [] };

  const serving = station.servingCustomerId
    ? (state.customers.find((c) => c.id === station.servingCustomerId) ?? null)
    : null;
  const queued = station.queuedCustomerIds
    .map((id) => state.customers.find((c) => c.id === id))
    .filter(Boolean) as RetailCustomer[];

  return { serving, queued };
}
