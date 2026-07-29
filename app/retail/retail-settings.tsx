"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Bell,
  Buildings,
  CaretRight,
  Envelope,
  Gear,
  LockKey,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import { RETAIL_STAFF } from "./retail-staff";

interface RetailSettingsProps {
  onBack: () => void;
}

function SettingsRow({
  icon,
  label,
  sub,
  right,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={[
        "flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors",
        onClick
          ? "cursor-pointer hover:bg-slate-50 active:bg-slate-100"
          : "cursor-default",
        danger ? "text-red-600" : "text-slate-800",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          danger ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-600",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>
        )}
      </span>
      {right ?? (onClick && !danger ? (
        <CaretRight size={16} className="shrink-0 text-slate-400" />
      ) : null)}
    </div>
  );
}

export function RetailSettings({ onBack }: RetailSettingsProps) {
  const [notifyQueue, setNotifyQueue] = useState(true);
  const [notifyApps, setNotifyApps] = useState(true);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-[#0033AA]"
        >
          <ArrowLeft size={16} weight="bold" />
          Back to CRM
        </button>

        <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Image
            src={RETAIL_STAFF.avatarSrc}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">
              {RETAIL_STAFF.name}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{RETAIL_STAFF.role}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <Buildings size={12} />
              {RETAIL_STAFF.outlet}
            </p>
          </div>
        </div>

        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          <div className="px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Account
            </h2>
          </div>
          <SettingsRow
            icon={<UserCircle size={18} />}
            label="Full name"
            sub={RETAIL_STAFF.name}
          />
          <SettingsRow
            icon={<Envelope size={18} />}
            label="Work email"
            sub={RETAIL_STAFF.email}
          />
          <SettingsRow
            icon={<Buildings size={18} />}
            label="Outlet"
            sub={RETAIL_STAFF.outlet}
          />
        </section>

        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          <div className="px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Notifications
            </h2>
          </div>
          <SettingsRow
            icon={<Bell size={18} />}
            label="Queue alerts"
            sub="New walk-ins and station calls"
            right={
              <button
                type="button"
                role="switch"
                aria-checked={notifyQueue}
                onClick={() => setNotifyQueue((v) => !v)}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                  notifyQueue ? "bg-[#0033AA]" : "bg-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    notifyQueue ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            }
          />
          <SettingsRow
            icon={<Bell size={18} />}
            label="Application updates"
            sub="Status changes and document requests"
            right={
              <button
                type="button"
                role="switch"
                aria-checked={notifyApps}
                onClick={() => setNotifyApps((v) => !v)}
                className={[
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                  notifyApps ? "bg-[#0033AA]" : "bg-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    notifyApps ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            }
          />
        </section>

        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          <div className="px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Preferences
            </h2>
          </div>
          <SettingsRow
            icon={<Gear size={18} />}
            label="Default tab"
            sub="Queue"
          />
          <SettingsRow
            icon={<LockKey size={18} />}
            label="Session"
            sub="Signed in on this device"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-red-100 bg-white shadow-sm">
          <SettingsRow
            icon={<SignOut size={18} />}
            label="Sign out"
            sub="End your session on this workstation"
            onClick={() => {
              window.location.href = "/";
            }}
            danger
          />
        </section>
      </div>
    </div>
  );
}
