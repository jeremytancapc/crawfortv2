"use client";

import { useMemo, useRef, useState } from "react";
import {
  MagnifyingGlass,
  X,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  CaretUpDown,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  ArrowLeft,
  UploadSimple,
  Trash,
  FileText,
  CheckCircle,
  Warning,
  ChatCircleDots,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import type {
  RetailApplication,
  ApplicationStatus,
  ApplicationDocument,
  BorrowerType,
} from "./types";
import { buildInitialApplications, formatCurrency } from "./mock-data";

// ─── Status / badge config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string }> = {
  CREATE:      { label: "Create",      classes: "text-slate-600 bg-slate-100 border-slate-200" },
  VERIFIED:    { label: "Verified",    classes: "text-teal-700 bg-teal-50 border-teal-200" },
  ELIGIBILITY: { label: "Eligibility", classes: "text-amber-700 bg-amber-50 border-amber-200" },
  E_SIGN:      { label: "E-Sign",      classes: "text-blue-700 bg-blue-50 border-blue-200" },
  REJECTED:    { label: "Rejected",    classes: "text-red-700 bg-red-50 border-red-200" },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// ─── Readonly field helpers (mirrors the synced, view-only web application) ────

function ReadonlyField({
  label,
  value,
  placeholder = "-",
  required = false,
  trailing,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  required?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {required && <span className="text-red-500 mr-0.5">*</span>}
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm truncate">
          <span className={value ? "text-slate-700 font-medium" : "text-slate-400"}>
            {value ?? placeholder}
          </span>
        </div>
        {trailing}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800 text-right truncate">{value}</span>
    </div>
  );
}

// ─── Confirm popover for "Set Invalid" ─────────────────────────────────────────

function SetInvalidControl({
  isInvalid,
  onConfirm,
}: {
  isInvalid: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (isInvalid) {
    return <span className="text-xs font-medium text-slate-400">Invalid</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-md transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-1.5 py-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className="text-xs font-semibold text-[#0033AA] hover:underline"
    >
      Set Invalid
    </button>
  );
}

// ─── Document uploader (functional, in-memory) ─────────────────────────────────

function DocumentUploader({
  documents,
  onAdd,
  onRemove,
}: {
  documents: ApplicationDocument[];
  onAdd: (files: File[]) => void;
  onRemove: (docId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onAdd(Array.from(fileList));
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer",
          isDragging ? "border-[#0033AA] bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-slate-50/60",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
          <UploadSimple size={18} className="text-[#0033AA]" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          Click to add, or drag documents here
        </p>
        <p className="text-xs text-slate-400">PDF, JPG or PNG - max 10MB per file</p>
      </div>

      {documents.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <FileText size={18} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                <p className="text-xs text-slate-400">
                  {doc.sizeLabel} · uploaded by {doc.uploadedBy} · {doc.uploadedAt}
                </p>
              </div>
              <button
                onClick={() => onRemove(doc.id)}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                aria-label={`Remove ${doc.name}`}
              >
                <Trash size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── General tab ────────────────────────────────────────────────────────────────

function GeneralTab({
  app,
  onAddDocument,
  onRemoveDocument,
  onAddComment,
}: {
  app: RetailApplication;
  onAddDocument: (files: File[]) => void;
  onRemoveDocument: (docId: string) => void;
  onAddComment: (text: string) => void;
}) {
  const [savedTick, setSavedTick] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  function handleSave() {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  }

  function handlePostComment() {
    const text = commentDraft.trim();
    if (!text) return;
    onAddComment(text);
    setCommentDraft("");
  }

  const staffDocuments = app.documents.filter((d) => d.uploadedBy !== "Customer (Online)");
  const customerDocuments = app.documents.filter((d) => d.uploadedBy === "Customer (Online)");

  return (
    <div className="space-y-5">
      {/* Application + Loan Expectation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Application</h3>
          <div className="divide-y divide-slate-100">
            <InfoRow label="Application ID" value={app.id} />
            <InfoRow label="Status" value={<StatusBadge status={app.status} />} />
            <InfoRow label="Created at" value={app.createdAtTimeLabel} />
            <InfoRow label="Updated at" value={app.updatedAtTimeLabel} />
            <InfoRow label="Borrower" value={app.customerName} />
            <InfoRow label="Registered Mobile Number" value={app.registeredMobile} />
            <InfoRow label="Secondary Mobile Number" value={app.secondaryMobile ?? "-"} />
            <InfoRow label="Risk Level" value={app.riskLevel ?? "-"} />
            <InfoRow label="Credit Limit" value={app.creditLimit != null ? formatCurrency(app.creditLimit) : "-"} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Loan Expectation</h3>
          <div className="space-y-3.5">
            <ReadonlyField label="Expected Amount" value={formatCurrency(app.expectedAmount)} />
            <ReadonlyField
              label="Amount"
              required
              value={app.loanExpectation.amount != null ? formatCurrency(app.loanExpectation.amount) : null}
              placeholder="Pending customer e-sign"
            />
            <ReadonlyField label="Product" required value={app.loanExpectation.product} placeholder="Not yet selected" />
            <ReadonlyField
              label="Instalment"
              required
              value={app.loanExpectation.installment != null ? `${app.loanExpectation.installment} months` : null}
              placeholder="Not yet selected"
            />
            <div className="grid grid-cols-2 gap-3">
              <ReadonlyField label="Interest" required value={app.loanExpectation.interestRate} placeholder="Not yet selected" />
              <ReadonlyField label="Processing Fee" required value={app.loanExpectation.processingFee} placeholder="Not yet selected" />
            </div>
          </div>
        </div>
      </div>

      {/* Income and Other Documents */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Income and Other Documents</h3>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-md transition-all hover:opacity-90"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            {savedTick ? <CheckCircle size={14} weight="fill" /> : null}
            {savedTick ? "Saved" : "Save"}
          </button>
        </div>

        <div className="space-y-3.5">
          <ReadonlyField
            label="Income Document Type"
            value={app.incomeInfo.documentType}
            trailing={
              <button className="flex-shrink-0 text-xs font-semibold text-slate-400 px-2 py-2.5 cursor-not-allowed" disabled>
                View
              </button>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {app.incomeInfo.monthlyIncomes.map((amt, i) => (
              <ReadonlyField key={i} label={`Monthly Income ${i + 1}`} value={formatCurrency(amt)} />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <InfoRow label="Average Monthly Income" value={formatCurrency(app.incomeInfo.averageMonthlyIncome)} />
            <InfoRow label="Annually Income" value={formatCurrency(app.incomeInfo.annualIncome)} />
          </div>
        </div>

        {/* Submitted documents (from customer, view-only) */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">
            Submitted by Customer
          </p>
          {customerDocuments.length === 0 ? (
            <p className="text-sm text-slate-400">No documents submitted yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {customerDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                  <FileText size={18} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-600 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.sizeLabel} · {doc.uploadedAt}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Staff document upload */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">
            Document
          </p>
          <DocumentUploader documents={staffDocuments} onAdd={onAddDocument} onRemove={onRemoveDocument} />
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Comments</h3>

        {app.comments.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <ChatCircleDots size={16} />
            No comments yet.
          </div>
        ) : (
          <ul className="space-y-3 mb-4">
            {app.comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-[#0033AA] text-xs font-bold flex items-center justify-center">
                  {c.author.replace("Staff: ", "").slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{c.author.replace("Staff: ", "")}</p>
                    <p className="text-xs text-slate-400">{c.timestamp}</p>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-start gap-2">
          <textarea
            rows={2}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add an internal comment…"
            className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0033AA] transition-colors resize-none"
          />
          <button
            onClick={handlePostComment}
            disabled={!commentDraft.trim()}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm font-bold text-white px-3.5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            <PaperPlaneTilt size={14} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Borrower Information tab ──────────────────────────────────────────────────

function BorrowerInformationTab({ app }: { app: RetailApplication }) {
  const b = app.borrowerInfo;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Personal Details</h3>
        <div className="divide-y divide-slate-100">
          <InfoRow label="Full Name" value={b.fullName} />
          <InfoRow label="NRIC" value={b.nric} />
          <InfoRow label="Date of Birth" value={b.dateOfBirth} />
          <InfoRow label="Gender" value={b.gender} />
          <InfoRow label="Nationality" value={b.nationality} />
          <InfoRow label="Race" value={b.race} />
          <InfoRow label="Marital Status" value={b.maritalStatus} />
          <InfoRow label="Email" value={b.email} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Residential Details</h3>
        <div className="divide-y divide-slate-100">
          <InfoRow label="Address" value={<span className="whitespace-normal">{b.address}</span>} />
          <InfoRow label="Postal Code" value={b.postalCode} />
          <InfoRow label="Residential Status" value={b.residentialStatus} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Employment &amp; Income</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-slate-100">
          <div className="divide-y divide-slate-100">
            <InfoRow label="Employment Status" value={b.employmentStatus} />
            <InfoRow label="Employer Name" value={b.employerName} />
          </div>
          <div className="divide-y divide-slate-100">
            <InfoRow label="Occupation" value={b.occupation} />
            <InfoRow label="Length of Employment" value={b.employmentLength} />
            <InfoRow label="Monthly Household Income" value={formatCurrency(b.monthlyHouseholdIncome)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MLCB tab ───────────────────────────────────────────────────────────────────

const LENDER_STATUS_CONFIG: Record<"current" | "arrears" | "closed", { label: string; classes: string }> = {
  current: { label: "Current", classes: "text-teal-700 bg-teal-50 border-teal-200" },
  arrears: { label: "Arrears", classes: "text-red-700 bg-red-50 border-red-200" },
  closed:  { label: "Closed",  classes: "text-slate-500 bg-slate-50 border-slate-200" },
};

function MlcbTab({ app }: { app: RetailApplication }) {
  const m = app.mlcb;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Credit Bureau Summary</h3>
          <p className="text-xs text-slate-400">Report date: {m.reportDate}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "MLCB Score",       value: String(m.score) },
            { label: "Active Loans",     value: String(m.activeLoans) },
            { label: "Total Outstanding", value: formatCurrency(m.totalOutstanding) },
            { label: "Enquiries (6mo)",  value: String(m.enquiriesLast6Months) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3.5">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-bold text-slate-800 text-lg mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="text-sm font-bold text-slate-800 px-5 pt-5 pb-3">Lender Exposure</h3>
        <div className="hidden sm:flex items-center px-5 py-2 bg-slate-50 border-y border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
          <div className="flex-1">Lender</div>
          <div className="w-40">Loan Type</div>
          <div className="w-28 text-right">Outstanding</div>
          <div className="w-24 text-right">Status</div>
        </div>
        <div className="divide-y divide-slate-100">
          {m.lenders.map((l, i) => {
            const cfg = LENDER_STATUS_CONFIG[l.status];
            return (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 px-5 py-3">
                <div className="flex-1 text-sm font-medium text-slate-700">{l.lender}</div>
                <div className="w-40 text-sm text-slate-500">{l.loanType}</div>
                <div className="w-28 text-sm font-semibold text-slate-800 sm:text-right">{formatCurrency(l.outstanding)}</div>
                <div className="w-24 sm:text-right">
                  <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Rejected History tab ──────────────────────────────────────────────────────

function RejectedHistoryTab({ app }: { app: RetailApplication }) {
  if (app.rejectedHistory.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <CheckCircle size={22} className="text-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No rejected history</p>
        <p className="text-xs text-slate-400 mt-1">This borrower has no prior rejected applications on record.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="hidden sm:flex items-center px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <div className="w-28">Date</div>
        <div className="w-28">Application ID</div>
        <div className="flex-1">Reason</div>
        <div className="w-32 text-right">Reviewed By</div>
      </div>
      <div className="divide-y divide-slate-100">
        {app.rejectedHistory.map((r, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 px-5 py-3">
            <div className="w-28 text-sm text-slate-500">{r.date}</div>
            <div className="w-28 text-sm font-mono font-semibold text-slate-700">{r.applicationId}</div>
            <div className="flex-1 flex items-start gap-1.5 text-sm text-slate-700">
              <Warning size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              {r.reason}
            </div>
            <div className="w-32 text-sm text-slate-500 sm:text-right">{r.reviewedBy}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Application detail view ───────────────────────────────────────────────────

type DetailTab = "general" | "borrower" | "mlcb" | "rejected";

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "general",  label: "General" },
  { id: "borrower", label: "Borrower Information" },
  { id: "mlcb",     label: "MLCB" },
  { id: "rejected", label: "Rejected History" },
];

interface ApplicationDetailProps {
  app: RetailApplication;
  onBack: () => void;
  onAddDocument: (files: File[]) => void;
  onRemoveDocument: (docId: string) => void;
  onAddComment: (text: string) => void;
}

function ApplicationDetail({ app, onBack, onAddDocument, onRemoveDocument, onAddComment }: ApplicationDetailProps) {
  const [tab, setTab] = useState<DetailTab>("general");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-6 py-3.5 bg-white border-b border-slate-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#0033AA] transition-colors"
        >
          <ArrowLeft size={16} />
          Applications
        </button>
        <div className="w-px h-4 bg-slate-200" />
        <p className="text-sm font-bold text-slate-800 truncate">{app.customerName}</p>
        <span className="text-xs font-mono text-slate-400 truncate hidden sm:inline">{app.id}</span>
        <div className="ml-auto flex-shrink-0">
          <StatusBadge status={app.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 lg:px-6 bg-white border-b border-slate-200 overflow-x-auto">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "px-3.5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-[#0033AA] text-[#0033AA]"
                : "border-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {t.label}
            {t.id === "rejected" && app.rejectedHistory.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold w-4 h-4 rounded-full bg-red-100 text-red-600">
                {app.rejectedHistory.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 px-4 lg:px-6 py-5">
        {tab === "general"  && (
          <GeneralTab
            app={app}
            onAddDocument={onAddDocument}
            onRemoveDocument={onRemoveDocument}
            onAddComment={onAddComment}
          />
        )}
        {tab === "borrower" && <BorrowerInformationTab app={app} />}
        {tab === "mlcb"     && <MlcbTab app={app} />}
        {tab === "rejected" && <RejectedHistoryTab app={app} />}
      </div>
    </div>
  );
}

// ─── Table row ──────────────────────────────────────────────────────────────────

const BORROWER_TYPE_LABEL: Record<BorrowerType, string> = {
  BORROWER: "Borrower",
  APPLICANT: "Applicant",
};

interface ApplicationRowProps {
  app: RetailApplication;
  index: number;
  onClick: () => void;
  onSetInvalid: () => void;
}

function ApplicationRow({ app, index, onClick, onSetInvalid }: ApplicationRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full text-left grid grid-cols-[40px_100px_1fr_100px_110px_100px_110px_110px_110px_100px] items-center gap-2 px-4 py-3 border-b border-slate-100 hover:bg-blue-50/40 transition-colors text-sm cursor-pointer"
    >
      <span className="text-slate-400">{index}</span>
      <span className="font-semibold text-[#0033AA] truncate">{app.id}</span>
      <span className="text-slate-700 truncate" title={app.customerName}>{app.customerName}</span>
      <span className="text-slate-600 truncate">{BORROWER_TYPE_LABEL[app.borrowerType]}</span>
      <span className="text-slate-600 font-mono text-xs truncate">{app.idNumberMasked}</span>
      <span className="text-slate-600 font-mono text-xs truncate">{app.mobileMasked}</span>
      <span className="text-slate-500 truncate">{app.createdAtLabel}</span>
      <span className="font-semibold text-slate-800 truncate">{formatCurrency(app.expectedAmount)}</span>
      <span className="truncate">
        <StatusBadge status={app.status} />
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <SetInvalidControl isInvalid={app.isInvalid} onConfirm={onSetInvalid} />
      </span>
    </div>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────────

function getPageWindow(current: number, total: number): number[] {
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

function Pagination({
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pages = getPageWindow(page, totalPages);

  return (
    <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>Total <strong className="text-slate-700">{totalRecords.toLocaleString()}</strong> records</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 focus:outline-none focus:border-[#0033AA] bg-white"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} items/page</option>
            ))}
          </select>
          <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <CaretDoubleLeft size={14} />
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <CaretLeft size={14} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={[
              "w-7 h-7 rounded-md text-xs font-bold transition-colors",
              p === page ? "bg-[#0033AA] text-white" : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <CaretRight size={14} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <CaretDoubleRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Applications table ─────────────────────────────────────────────────────────

type SortKey = "createdAtISO" | "expectedAmount";
type SortDir = "asc" | "desc";

const TABLE_COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: null, label: "Index" },
  { key: null, label: "Application ID" },
  { key: null, label: "Customer" },
  { key: null, label: "Borrower Type" },
  { key: null, label: "ID Number" },
  { key: null, label: "Mobile Number" },
  { key: "createdAtISO", label: "Creation Time" },
  { key: "expectedAmount", label: "Expected Amount" },
  { key: null, label: "Status" },
  { key: null, label: "Operation" },
];

export function ApplicationsTab() {
  const [applications, setApplications] = useState<RetailApplication[]>(() => buildInitialApplications());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [borrowerTypeFilter, setBorrowerTypeFilter] = useState<BorrowerType | "all">("all");

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  function handleSearch() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  function handleReset() {
    setSearchDraft("");
    setSearch("");
    setStatusFilter("all");
    setBorrowerTypeFilter("all");
    setSort(null);
    setPage(1);
  }

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
    setPage(1);
  }

  function handleSetInvalid(id: string) {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, isInvalid: true } : a)));
  }

  function handleAddDocument(id: string, files: File[]) {
    setApplications((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const now = new Date();
      const newDocs: ApplicationDocument[] = files.map((f, i) => ({
        id: `staff-doc-${Date.now()}-${i}`,
        name: f.name,
        sizeLabel: formatBytes(f.size),
        uploadedAt: now.toLocaleString("en-SG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        uploadedBy: "Staff",
      }));
      return { ...a, documents: [...a.documents, ...newDocs] };
    }));
  }

  function handleRemoveDocument(id: string, docId: string) {
    setApplications((prev) => prev.map((a) => (
      a.id !== id ? a : { ...a, documents: a.documents.filter((d) => d.id !== docId) }
    )));
  }

  function handleAddComment(id: string, text: string) {
    setApplications((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const now = new Date();
      const newComment = {
        id: `comment-${Date.now()}`,
        author: "Staff: You",
        timestamp: now.toLocaleString("en-SG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        text,
      };
      return { ...a, comments: [...a.comments, newComment] };
    }));
  }

  const filtered = useMemo(() => {
    let list = applications;

    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (borrowerTypeFilter !== "all") list = list.filter((a) => a.borrowerType === borrowerTypeFilter);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.id.toLowerCase().includes(q) ||
        a.customerName.toLowerCase().includes(q) ||
        a.idNumberMasked.toLowerCase().includes(q) ||
        a.mobileMasked.toLowerCase().includes(q)
      );
    }

    if (sort) {
      list = [...list].sort((a, b) => {
        const av = sort.key === "createdAtISO" ? new Date(a.createdAtISO).getTime() : a.expectedAmount;
        const bv = sort.key === "createdAtISO" ? new Date(b.createdAtISO).getTime() : b.expectedAmount;
        return sort.dir === "asc" ? av - bv : bv - av;
      });
    }

    return list;
  }, [applications, search, statusFilter, borrowerTypeFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const selectedApp = selectedId ? applications.find((a) => a.id === selectedId) ?? null : null;

  if (selectedApp) {
    return (
      <ApplicationDetail
        app={selectedApp}
        onBack={() => setSelectedId(null)}
        onAddDocument={(files) => handleAddDocument(selectedApp.id, files)}
        onRemoveDocument={(docId) => handleRemoveDocument(selectedApp.id, docId)}
        onAddComment={(text) => handleAddComment(selectedApp.id, text)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">Applications</h2>
          </div>
          <button
            onClick={handleReset}
            title="Refresh"
            className="flex-shrink-0 p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowsClockwise size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter search content and select field…"
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
            />
            {searchDraft && (
              <button onClick={() => setSearchDraft("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--brand-blue-hex)" }}
          >
            Search
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 border-2 border-slate-200 hover:border-slate-300 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#0033AA] hover:bg-blue-50 transition-colors"
          >
            {showFilters ? "Collapse" : "Expand"}
            <CaretDown size={13} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-3 border-t border-slate-100">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ApplicationStatus | "all"); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-semibold focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>

            <div className="relative">
              <select
                value={borrowerTypeFilter}
                onChange={(e) => { setBorrowerTypeFilter(e.target.value as BorrowerType | "all"); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-semibold focus:outline-none focus:border-[#0033AA] transition-colors bg-white"
              >
                <option value="all">All Borrower Types</option>
                <option value="BORROWER">Borrower</option>
                <option value="APPLICANT">Applicant</option>
              </select>
              <CaretDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="min-w-[1080px]">
          {/* Column headers */}
          <div className="grid grid-cols-[40px_100px_1fr_100px_110px_100px_110px_110px_110px_100px] items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 sticky top-0 text-xs font-bold text-slate-500 uppercase tracking-wide">
            {TABLE_COLUMNS.map((col) => (
              <span key={col.label} className={col.key ? "flex items-center gap-1 cursor-pointer select-none hover:text-slate-700" : ""} onClick={col.key ? () => handleSort(col.key as SortKey) : undefined}>
                {col.label}
                {col.key && (
                  sort?.key === col.key
                    ? (sort.dir === "asc" ? <CaretUp size={11} /> : <CaretDown size={11} />)
                    : <CaretUpDown size={11} className="opacity-40" />
                )}
              </span>
            ))}
          </div>

          {pageRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <MagnifyingGlass size={32} className="mb-3 opacity-40" />
              <p className="text-sm">No applications match your filters</p>
            </div>
          ) : (
            pageRows.map((app, i) => (
              <ApplicationRow
                key={app.id}
                app={app}
                index={pageStart + i + 1}
                onClick={() => setSelectedId(app.id)}
                onSetInvalid={() => handleSetInvalid(app.id)}
              />
            ))
          )}
        </div>
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        totalRecords={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}
