"use client";

import React, { createContext, useContext, useReducer, useCallback } from "react";
import type {
  RetailCustomer,
  Station,
  AppointmentType,
  ApprovedLoanOffer,
  ConfirmedLoanPlan,
  StaffAlert,
} from "./types";
import {
  buildInitialCustomers,
  buildInitialStations,
  buildApprovedLoanOffers,
  seedArrivedCustomerCare,
} from "./mock-data";
import { RETAIL_STAFF, stationRequiresStaff } from "./retail-staff";

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
  /** Pre-approved loan offers keyed by customer ID (customer-care only) */
  loanOffers: Record<string, ApprovedLoanOffer>;
  /** Confirmed loan plans saved by staff, keyed by customer ID */
  loanPlans: Record<string, ConfirmedLoanPlan>;
  /** Pending call-to-station alerts for the allocated staff member */
  staffAlerts: StaffAlert[];
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
  | { type: "REGISTER_WALK_IN"; customer: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "assignedStaffId" | "queuePosition"> }
  | { type: "CONFIRM_LOAN_PLAN"; plan: ConfirmedLoanPlan }
  | { type: "ATTEND_CUSTOMER"; alertId: string };

function createStaffAlert(customerId: string, stationId: string): StaffAlert {
  return {
    id: `alert-${customerId}-${stationId}-${Date.now()}`,
    customerId,
    stationId,
    staffId: RETAIL_STAFF.id,
    createdAt: new Date().toISOString(),
  };
}

/** Drop any pending alerts for a customer (reassign / already attended). */
function clearAlertsForCustomer(alerts: StaffAlert[], customerId: string): StaffAlert[] {
  return alerts.filter((a) => a.customerId !== customerId);
}

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
      const needsStaff = stationRequiresStaff(station.type);
      // Allocate logged-in officer when a staffed station starts calling
      const allocatedStaffId =
        isFree && needsStaff ? RETAIL_STAFF.id : null;

      const updatedCustomers = state.customers.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          status: isFree ? ("called" as const) : ("queued" as const),
          assignedStationId: stationId,
          assignedStaffId: isFree ? allocatedStaffId : null,
          queuePosition: queuePos,
        };
      });

      // Free staffed station → ping the allocated officer
      const staffAlerts =
        isFree && needsStaff
          ? [
              ...clearAlertsForCustomer(state.staffAlerts, customerId),
              createStaffAlert(customerId, stationId),
            ]
          : clearAlertsForCustomer(state.staffAlerts, customerId);

      return {
        ...state,
        customers: updatedCustomers,
        stations: updatedStations,
        selectedCustomerId: null,
        staffAlerts,
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

      const servingId = station.servingCustomerId;
      const staffAlerts = servingId
        ? clearAlertsForCustomer(state.staffAlerts, servingId)
        : state.staffAlerts;

      return {
        ...state,
        stations: updatedStations,
        customers: updatedCustomers,
        activeStationId: null,
        staffAlerts,
      };
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

      const needsStaff = stationRequiresStaff(station.type);
      const nextStaffId = nextId && needsStaff ? RETAIL_STAFF.id : null;

      const updatedCustomers = state.customers.map((c) => {
        if (c.id === justFinished) {
          return {
            ...c,
            status: "done" as const,
            assignedStationId: null,
            queuePosition: null,
            // Keep assignedStaffId so history shows who served
          };
        }
        if (c.id === nextId) {
          return {
            ...c,
            status: "called" as const,
            queuePosition: 0,
            assignedStaffId: nextStaffId,
          };
        }
        if (station.queuedCustomerIds.includes(c.id) && c.id !== nextId) {
          const newPos = remainingQueue.indexOf(c.id) + 1;
          return { ...c, queuePosition: newPos };
        }
        return c;
      });

      let staffAlerts = justFinished
        ? clearAlertsForCustomer(state.staffAlerts, justFinished)
        : state.staffAlerts;

      // Next in queue is now being called — allocate & ping staff for room/cashier
      if (nextId && needsStaff) {
        staffAlerts = [
          ...clearAlertsForCustomer(staffAlerts, nextId),
          createStaffAlert(nextId, action.stationId),
        ];
      }

      return {
        ...state,
        stations: updatedStations,
        customers: updatedCustomers,
        activeStationId: null,
        staffAlerts,
      };
    }

    case "ATTEND_CUSTOMER": {
      const alert = state.staffAlerts.find((a) => a.id === action.alertId);
      if (!alert) return state;

      const withoutAlert: RetailState = {
        ...state,
        staffAlerts: state.staffAlerts.filter((a) => a.id !== action.alertId),
      };

      const station = withoutAlert.stations.find((s) => s.id === alert.stationId);
      // Only advance to serving if this alert still matches the station's called customer
      if (
        station &&
        station.status === "calling" &&
        station.servingCustomerId === alert.customerId
      ) {
        return retailReducer(withoutAlert, {
          type: "CUSTOMER_ARRIVED",
          stationId: alert.stationId,
        });
      }

      return withoutAlert;
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
      let promotedCustomerId: string | null = null;

      if (stationId) {
        const station = state.stations.find((s) => s.id === stationId);
        if (station) {
          const wasServing =
            station.servingCustomerId === customer.id &&
            (station.status === "calling" || station.status === "occupied");

          if (wasServing) {
            // Pull next from that station's queue, or free it
            const [nextId, ...remainingQueue] = station.queuedCustomerIds;
            promotedCustomerId = nextId ?? null;
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

      const remainingAtStation =
        stationId
          ? (updatedStations.find((s) => s.id === stationId)?.queuedCustomerIds ?? [])
          : [];

      const promotedStation = stationId
        ? updatedStations.find((s) => s.id === stationId)
        : undefined;
      const promoteNeedsStaff = promotedStation
        ? stationRequiresStaff(promotedStation.type)
        : false;
      const promotedStaffId =
        promotedCustomerId && promoteNeedsStaff ? RETAIL_STAFF.id : null;

      const updatedCustomers = state.customers.map((c) => {
        if (c.id === customer.id) {
          return {
            ...c,
            status: "scheduled" as const,
            assignedStationId: null,
            assignedStaffId: null,
            queuePosition: null,
          };
        }
        // Promote next in line if we freed a serving slot
        if (c.id === promotedCustomerId && c.status === "queued") {
          return {
            ...c,
            status: "called" as const,
            queuePosition: 0,
            assignedStaffId: promotedStaffId,
          };
        }
        // Recompute queue positions for remaining waiters
        if (remainingAtStation.includes(c.id)) {
          return { ...c, queuePosition: remainingAtStation.indexOf(c.id) + 1 };
        }
        return c;
      });

      // Clear alert for the reassigned customer; ping staff if someone was promoted
      let staffAlerts = clearAlertsForCustomer(state.staffAlerts, customer.id);
      if (promotedCustomerId && stationId && promoteNeedsStaff) {
        staffAlerts = [
          ...clearAlertsForCustomer(staffAlerts, promotedCustomerId),
          createStaffAlert(promotedCustomerId, stationId),
        ];
      }

      return {
        ...state,
        customers: updatedCustomers,
        stations: updatedStations,
        selectedCustomerId: customer.id,
        activeStationId: null,
        staffAlerts,
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
        assignedStaffId: null,
        queuePosition: null,
      };

      return {
        ...state,
        customers: [...state.customers, newCustomer],
        queueCounters: { ...state.queueCounters, [prefix]: newCount },
        selectedCustomerId: newCustomer.id,
      };
    }

    case "CONFIRM_LOAN_PLAN":
      return {
        ...state,
        loanPlans: { ...state.loanPlans, [action.plan.customerId]: action.plan },
      };

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
  registerWalkIn: (customer: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "assignedStaffId" | "queuePosition">) => void;
  confirmLoanPlan: (plan: ConfirmedLoanPlan) => void;
  attendCustomer: (alertId: string) => void;
}

const RetailContext = createContext<RetailContextValue | null>(null);

function buildInitialState(): RetailState {
  const customers = buildInitialCustomers();
  const stations = buildInitialStations();

  // Seed a few customer-care customers as already arrived for a realistic demo
  seedArrivedCustomerCare(customers, stations);

  // Determine starting counters from seeded data
  const counters = { L: 0, C: 0, P: 0, D: 0 };
  customers.forEach((c) => {
    const prefix = queuePrefixFor(c.appointmentType);
    counters[prefix] = Math.max(counters[prefix], parseInt(c.queueNumber.slice(1), 10));
  });

  // Demo: cust-5 is already "called" at room-2 — staff needs to go there now
  const staffAlerts: StaffAlert[] = [];
  const calledSeed = customers.find((c) => c.id === "cust-5" && c.status === "called");
  if (calledSeed?.assignedStationId) {
    staffAlerts.push({
      id: "alert-seed-cust-5",
      customerId: calledSeed.id,
      stationId: calledSeed.assignedStationId,
      staffId: RETAIL_STAFF.id,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    customers,
    stations,
    selectedCustomerId: null,
    activeStationId: null,
    queueCounters: counters,
    loanOffers: buildApprovedLoanOffers(customers),
    loanPlans: {},
    staffAlerts,
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
  const registerWalkIn   = useCallback((c: Omit<RetailCustomer, "id" | "queueNumber" | "status" | "assignedStationId" | "assignedStaffId" | "queuePosition">) =>
    dispatch({ type: "REGISTER_WALK_IN", customer: c }), []);
  const confirmLoanPlan  = useCallback((plan: ConfirmedLoanPlan) => dispatch({ type: "CONFIRM_LOAN_PLAN", plan }), []);
  const attendCustomer   = useCallback((alertId: string) => dispatch({ type: "ATTEND_CUSTOMER", alertId }), []);

  return (
    <RetailContext.Provider value={{ state, selectCustomer, openStationSheet, assignStation, customerArrived, completeService, autoAssign, reassign, registerWalkIn, confirmLoanPlan, attendCustomer }}>
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
