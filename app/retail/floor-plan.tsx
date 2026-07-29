"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { X, Users, ArrowRight } from "@phosphor-icons/react";
import type { Station, StationType, AppointmentType } from "./types";
import { useRetail, useStationCustomers } from "./retail-store";

// ─── Station status → visual ─────────────────────────────────────────────────

const STATUS_GLOW: Record<Station["status"], { dot: string; glow: string; ring: string }> = {
  free:     { dot: "bg-green-400",  glow: "shadow-[0_0_8px_3px_rgba(74,222,128,0.7)]",  ring: "ring-green-200"  },
  calling:  { dot: "bg-yellow-400", glow: "shadow-[0_0_8px_3px_rgba(250,204,21,0.8)]",  ring: "ring-yellow-200" },
  occupied: { dot: "bg-red-400",    glow: "shadow-[0_0_8px_3px_rgba(248,113,113,0.7)]", ring: "ring-red-200"    },
};

// Which appointment types can use which station types
const COMPATIBLE: Record<AppointmentType, StationType> = {
  "loan-application":  "kiosk",
  "customer-care":     "room",
  "cash-repayment":    "cashier",
  "cash-disbursement": "cashier",
};

/** Station type → appointment-type color (matches queue badges) */
const TYPE_BORDER: Record<StationType, string> = {
  kiosk:   "border-blue-400",
  room:    "border-purple-400",
  // Cashier serves both Cash Repayment (green) + Cash Disbursement (amber)
  cashier: "border-transparent",
};

const CASHIER_BORDER_STYLE: CSSProperties = {
  background:
    "linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #10b981 0%, #10b981 45%, #f59e0b 55%, #f59e0b 100%) border-box",
  border: "2px solid transparent",
};

// ─── Station Tile ─────────────────────────────────────────────────────────────

interface StationTileProps {
  station: Station;
  isCompatible: boolean | null;  // null = no customer selected
  isHighlighted: boolean;
  onTap: () => void;
}

function StationTile({ station, isCompatible, isHighlighted, onTap }: StationTileProps) {
  const { serving, queued } = useStationCustomers(station.id);
  const glow = STATUS_GLOW[station.status];
  const queueCount = queued.length;

  const isDimmed = isCompatible === false;
  const typeBorder = TYPE_BORDER[station.type];
  const isCashier = station.type === "cashier";

  const tileSize = isCashier
    ? "w-full max-w-[180px] h-16"
    : "w-full h-14";

  const borderClass = isDimmed
    ? "border-slate-200"
    : isHighlighted
    ? "border-[#06DEC0]"
    : isCashier
    ? "border-transparent"
    : typeBorder;

  return (
    <button
      onClick={onTap}
      disabled={isDimmed}
      className={[
        tileSize,
        "relative rounded-md border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 select-none",
        borderClass,
        isDimmed
          ? "opacity-20 cursor-not-allowed bg-slate-100 grayscale"
          : isHighlighted
          ? "bg-white scale-105 shadow-lg z-10"
          : isCompatible
          ? "bg-white z-10 shadow-md ring-2 ring-white/80 hover:scale-105 active:scale-98"
          : "bg-white hover:scale-102 active:scale-98",
      ].join(" ")}
      style={
        isHighlighted
          ? { boxShadow: "0 0 0 2px #06DEC0, 0 4px 20px rgba(6,222,192,0.25)" }
          : isCashier && !isDimmed
          ? CASHIER_BORDER_STYLE
          : undefined
      }
      title={station.label}
    >
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${glow.dot} ${glow.glow} ${station.status === "calling" ? "animate-pulse" : ""}`} />

      {/* Label */}
      <span className="text-[10px] font-bold text-slate-600 leading-none">{station.label}</span>

      {/* Serving customer name */}
      {serving && (
        <span className="text-[9px] text-slate-500 leading-tight text-center px-1 w-full truncate" title={serving.name}>
          {serving.name}
        </span>
      )}

      {/* Queue badge */}
      {queueCount > 0 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0033AA] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
          +{queueCount}
        </div>
      )}
    </button>
  );
}

// ─── Station Action Sheet ─────────────────────────────────────────────────────

function StationActionSheet({ stationId, onClose }: { stationId: string; onClose: () => void }) {
  const { state, customerArrived, completeService } = useRetail();
  const station = state.stations.find((s) => s.id === stationId);
  const { serving, queued } = useStationCustomers(stationId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!station) return null;

  const glow = STATUS_GLOW[station.status];

  return (
    <div className="absolute inset-0 flex items-end justify-center z-40 bg-black/20 rounded-2xl" onClick={onClose}>
      <div
        ref={ref}
        className="w-full max-w-sm mx-4 mb-4 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ background: "var(--brand-blue-hex)" }}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${glow.dot} ${glow.glow} ${station.status === "calling" ? "animate-pulse" : ""}`} />
            <span className="text-white font-bold text-sm">{station.label}</span>
            <span className="text-white/70 text-xs capitalize">{station.status}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Serving */}
        {serving && (
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Currently {station.status === "calling" ? "called" : "serving"}</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0033AA]/10 flex items-center justify-center">
                <span className="text-xs font-bold text-[#0033AA]">{serving.queueNumber}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{serving.name}</p>
                <p className="text-xs text-slate-400">
                  {serving.appointmentType === "loan-application"
                    ? "Loan Application"
                    : serving.appointmentType === "customer-care"
                    ? "Customer Service"
                    : serving.appointmentType === "cash-disbursement"
                    ? "Cash Disbursement"
                    : "Cash Repayment"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Queue */}
        {queued.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
              <Users size={12} />
              {queued.length} in queue
            </p>
            <div className="space-y-1.5">
              {queued.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                  <span className="text-xs font-medium text-slate-700">{c.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{c.queueNumber}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 space-y-2">
          {station.status === "calling" && (
            <button
              onClick={() => { customerArrived(stationId); onClose(); }}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold text-sm transition-colors"
            >
              <span>Customer Arrived</span>
              <ArrowRight size={16} />
            </button>
          )}
          {(station.status === "occupied" || station.status === "calling") && (
            <button
              onClick={() => { completeService(stationId); onClose(); }}
              className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-sm transition-colors"
            >
              <span>{queued.length > 0 ? "Complete & Call Next" : "Complete Service"}</span>
              <ArrowRight size={16} />
            </button>
          )}
          {station.status === "free" && (
            <p className="text-center text-sm text-slate-400 py-2">Station is free</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Floor Plan Layout ────────────────────────────────────────────────────────

export function FloorPlan() {
  const { state, assignStation, openStationSheet } = useRetail();
  const [localActiveStation, setLocalActiveStation] = useState<string | null>(null);

  const selectedCustomer = state.selectedCustomerId
    ? state.customers.find((c) => c.id === state.selectedCustomerId) ?? null
    : null;

  // Determine which station types are compatible with the selected customer
  const compatibleType: StationType | null = selectedCustomer
    ? COMPATIBLE[selectedCustomer.appointmentType]
    : null;

  const kiosks  = state.stations.filter((s) => s.type === "kiosk");
  const rooms   = state.stations.filter((s) => s.type === "room");
  const cashier = state.stations.find((s) => s.type === "cashier")!;

  function handleStationTap(station: Station) {
    if (selectedCustomer) {
      // In assignment mode: only allow compatible + non-done stations
      if (station.type !== compatibleType) return;
      if (selectedCustomer.status !== "scheduled") return;
      assignStation(selectedCustomer.id, station.id);
    } else {
      // No customer selected: open action sheet
      setLocalActiveStation(station.id);
      openStationSheet(station.id);
    }
  }

  function isCompatible(station: Station): boolean | null {
    if (!selectedCustomer) return null;
    return station.type === compatibleType;
  }

  const activeSheet = localActiveStation ?? state.activeStationId;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Floor Plan</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)]" />
              Free
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_6px_2px_rgba(250,204,21,0.7)] animate-pulse" />
              Calling
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.7)]" />
              Occupied
            </span>
          </div>
        </div>
        {selectedCustomer && (
          <p className="mt-1.5 text-xs font-medium text-[#0033AA] bg-blue-50 px-3 py-1.5 rounded-lg">
            Assigning <strong>{selectedCustomer.name}</strong> — tap a compatible{" "}
            {compatibleType === "kiosk" ? "kiosk" : compatibleType === "room" ? "room" : "cashier counter"}
          </p>
        )}
      </div>

      {/* Outlet plan */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 lg:p-4 relative">
        <div
          className={[
            "relative w-full h-full min-h-[520px] border-2 rounded-2xl p-3 overflow-hidden transition-colors duration-200",
            selectedCustomer
              ? "border-slate-600"
              : "border-slate-400/60",
          ].join(" ")}
          style={
            selectedCustomer
              ? { backgroundColor: "#3f4650" }
              : {
                  // Light grey commercial carpet with woven pile
                  backgroundColor: "#d4d6d9",
                  backgroundImage: [
                    // Fine vertical pile threads
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 1px, transparent 1px, transparent 4px)",
                    // Fine horizontal weave
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 4px)",
                    // Subtle diagonal nap
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 2px, transparent 2px, transparent 6px)",
                    // Soft base wash
                    "linear-gradient(180deg, #e2e4e7 0%, #d4d6d9 50%, #c8cbd0 100%)",
                  ].join(", "),
                }
          }
        >
          {/* Dim overlay when assigning — keeps focus on compatible stations */}
          {selectedCustomer && (
            <div className="absolute inset-0 bg-black/50 pointer-events-none z-[1] rounded-2xl" />
          )}

          {/* Extra carpet grain when idle */}
          {!selectedCustomer && (
            <div
              className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply rounded-2xl"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                backgroundSize: "180px 180px",
              }}
            />
          )}

          {/* Door */}
          <div className={["absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-[2]", selectedCustomer ? "opacity-40" : ""].join(" ")}>
            <div className="w-20 h-3 rounded-b-lg border-2 border-t-0 border-[#0033AA] bg-[#0033AA]/10 flex items-center justify-center">
              <span className="text-[8px] font-bold text-[#0033AA]">ENTRANCE</span>
            </div>
          </div>

          {/* ── Kiosks (2 rows of 5) ──────────────────────────── */}
          <div className="mt-6 mb-4 relative z-[2]">
            <p className={["text-[10px] font-bold uppercase tracking-wider mb-2 text-center", selectedCustomer ? "text-slate-400" : "text-slate-500"].join(" ")}>Kiosks</p>
            <div className="grid grid-cols-5 gap-2 px-2">
              {kiosks.slice(0, 5).map((s) => (
                <StationTile
                  key={s.id}
                  station={s}
                  isCompatible={isCompatible(s)}
                  isHighlighted={activeSheet === s.id}
                  onTap={() => handleStationTap(s)}
                />
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2 px-2 mt-2">
              {kiosks.slice(5, 10).map((s) => (
                <StationTile
                  key={s.id}
                  station={s}
                  isCompatible={isCompatible(s)}
                  isHighlighted={activeSheet === s.id}
                  onTap={() => handleStationTap(s)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className={["h-px mx-4 my-3 relative z-[2]", selectedCustomer ? "bg-slate-500/40" : "bg-slate-400/25"].join(" ")} />

          {/* ── Rooms (3 left + 3 right, with open space in center) ─ */}
          <div className="relative z-[2]">
            <p className={["text-[10px] font-bold uppercase tracking-wider mb-2 text-center", selectedCustomer ? "text-slate-400" : "text-slate-500"].join(" ")}>Rooms</p>
            <div className="grid grid-cols-3 gap-2 px-2">
            {/* Left rooms */}
            <div className="space-y-2">
              {rooms.slice(0, 3).map((s) => (
                <StationTile
                  key={s.id}
                  station={s}
                  isCompatible={isCompatible(s)}
                  isHighlighted={activeSheet === s.id}
                  onTap={() => handleStationTap(s)}
                />
              ))}
            </div>

            {/* Center — waiting area label */}
            <div className={["flex items-center justify-center", selectedCustomer ? "opacity-30" : ""].join(" ")}>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full border-2 border-dashed border-slate-400/40 bg-white/40 flex items-center justify-center mb-1">
                  <span className="text-slate-400 text-lg">🪑</span>
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Waiting</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Area</p>
              </div>
            </div>

            {/* Right rooms */}
            <div className="space-y-2">
              {rooms.slice(3, 6).map((s) => (
                <StationTile
                  key={s.id}
                  station={s}
                  isCompatible={isCompatible(s)}
                  isHighlighted={activeSheet === s.id}
                  onTap={() => handleStationTap(s)}
                />
              ))}
            </div>
            </div>
          </div>

          {/* Divider */}
          <div className={["h-px mx-4 my-3 relative z-[2]", selectedCustomer ? "bg-slate-500/40" : "bg-slate-400/25"].join(" ")} />

          {/* ── Cashier (bottom center) ──────────────────────────── */}
          <div className="relative z-[2]">
            <p className={["text-[10px] font-bold uppercase tracking-wider mb-2 text-center", selectedCustomer ? "text-slate-400" : "text-slate-500"].join(" ")}>Cashier</p>
            <div className="flex justify-center px-2 mb-2">
              <StationTile
                station={cashier}
                isCompatible={isCompatible(cashier)}
                isHighlighted={activeSheet === cashier.id}
                onTap={() => handleStationTap(cashier)}
              />
            </div>
          </div>
        </div>

        {/* Action sheet overlay (inside scroll container) */}
        {activeSheet && (
          <StationActionSheet
            stationId={activeSheet}
            onClose={() => {
              setLocalActiveStation(null);
              openStationSheet(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
