"use client";

import { useState, useCallback, useEffect } from "react";
import mockPayload from "@/lib/mock-singpass-payload.json";

type Patch = Record<string, unknown>;

const MOCK_MYINFO = JSON.stringify(mockPayload.myinfo, null, 2);

export default function CallbackResultView({
  initialJson,
  rid,
}: {
  initialJson?: string;
  rid?: string;
}) {
  const [rawJson, setRawJson]     = useState(initialJson ?? MOCK_MYINFO);
  const [patch, setPatch]         = useState<Patch | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [activeTab, setActiveTab] = useState<"patch" | "raw">("patch");
  const [saving, setSaving]       = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  /** Wherever the real fields live - flat (legacy) or nested under
   *  person_info (FAPI 2.0). Editing the wrong level would silently no-op. */
  const personLevel = useCallback((obj: Record<string, unknown>): Record<string, unknown> => {
    const nested = obj.person_info;
    return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : obj;
  }, []);

  const stripField = useCallback(
    (field: string) => {
      setError(null);
      setSaveNotice(null);
      try {
        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        delete personLevel(parsed)[field];
        setRawJson(JSON.stringify(parsed, null, 2));
      } catch {
        setError("Invalid JSON - fix that before stripping a field.");
      }
    },
    [rawJson, personLevel],
  );

  const saveToCapture = useCallback(async () => {
    if (!rid) return;
    setSaveNotice(null);
    setError(null);
    setSaving(true);
    try {
      JSON.parse(rawJson); // fail early with the same message stripField uses
      const res = await fetch(`/api/dev/capture?rid=${rid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawJson,
      });
      if (!res.ok) {
        setError(`Save failed: server error ${res.status}`);
        return;
      }
      setSaveNotice(
        "Saved. A live application still on this rid will send this edited MyInfo to Ascend at submit.",
      );
    } catch {
      setError("Invalid JSON - check your input before saving.");
    } finally {
      setSaving(false);
    }
  }, [rawJson, rid]);

  const process = useCallback(async () => {
    setError(null);
    setPatch(null);
    setRawPayload(null);
    setLoading(true);
    try {
      let myinfo: unknown;
      try {
        myinfo = JSON.parse(rawJson);
      } catch {
        setError("Invalid JSON - check your input.");
        return;
      }

      // If the pasted JSON is a full webhook payload ({ myinfo: {...} }), unwrap it
      const myinfoObj =
        myinfo && typeof myinfo === "object" && "myinfo" in (myinfo as Record<string, unknown>)
          ? (myinfo as Record<string, unknown>).myinfo
          : myinfo;

      const res = await fetch("/api/dev/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myinfo: myinfoObj }),
      });
      if (!res.ok) {
        setError(`Server error ${res.status}`);
        return;
      }
      const data = (await res.json()) as { patch: Patch };
      setPatch(data.patch);
      setRawPayload(myinfoObj);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rawJson]);

  // A payload that arrived from Singpass should be readable the moment the
  // page loads - this page is opened by a redirect, not by hand.
  useEffect(() => {
    if (initialJson) void process();
    // First paint only: re-running on every keystroke would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 p-6 font-mono text-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900">MyInfo payload preview</h1>
        <p className="mt-1 text-xs text-slate-500">
          Paste a raw MyInfo object (or full webhook JSON) and click Process to see what
          the form would extract. URL: <code>/auth/callback-result</code>
        </p>
        {rid && (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-900">Live capture from Singpass</p>
            <p className="mt-1 text-[11px] text-emerald-800">
              Retrieval <code>{rid}</code>
              {" · read from myinfo_retrievals. This is data Singpass really returned, not the mock."}
            </p>
            <p className="mt-2 text-[11px] text-emerald-800">
              Edit the JSON below, then <b>Save to this capture</b> - any application still
              open on this same retrieval will send the edited MyInfo to Ascend at submit.
              The strip buttons below the textarea remove a field for you, so a typo can&apos;t
              break the JSON.
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            MyInfo JSON input
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setRawJson(MOCK_MYINFO)}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 active:bg-slate-100"
            >
              Load mock
            </button>
            <button
              onClick={() => { setRawJson(""); setPatch(null); setRawPayload(null); setError(null); }}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 active:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          rows={14}
          className="w-full rounded-lg border border-slate-300 bg-slate-950 p-4 text-xs text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder='Paste raw myinfo JSON here, or a full webhook payload { "myinfo": { ... } }'
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void process()}
            disabled={loading || !rawJson.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing…" : "Process →"}
          </button>

          {rid && (
            <>
              <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden />
              <button
                onClick={() => stripField("cpfcontributions")}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Remove CPF
              </button>
              <button
                onClick={() => stripField("noahistory")}
                className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Remove NOA
              </button>
              <button
                onClick={() => void saveToCapture()}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save to this capture"}
              </button>
            </>
          )}
        </div>
        {saveNotice && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            {saveNotice}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>
        )}
      </div>

      {/* Output */}
      {patch && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Output</span>
            <div className="flex overflow-hidden rounded-md border border-slate-300">
              {(["patch", "raw"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    activeTab === tab
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab === "patch" ? "Processed patch" : "Raw myinfo"}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "patch" && (
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-4">
              {/* Quick field summary */}
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-md border border-slate-700 bg-slate-900 p-3 sm:grid-cols-3">
                {(
                  [
                    ["authMethod",    patch.authMethod],
                    ["idType",        patch.idType],
                    ["fullName",      patch.fullName],
                    ["nric",          patch.nric],
                    ["dob",           patch.dob],
                    ["mobile",        patch.mobile],
                    ["email",         patch.email],
                    ["maritalStatus", patch.maritalStatus],
                    ["monthlyIncome", patch.monthlyIncome ? `$${patch.monthlyIncome}/mo` : undefined],
                    ["postalCode",    patch.postalCode],
                    ["address",       patch.address],
                    ["noaHistory",    Array.isArray(patch.noaHistory) ? `${(patch.noaHistory as unknown[]).length} record(s)` : undefined],
                    ["cpfContribs",   Array.isArray(patch.cpfContributions) ? `${(patch.cpfContributions as unknown[]).length} month(s)` : undefined],
                  ] as [string, unknown][]
                )
                  .filter(([, v]) => v !== undefined && v !== "" && v !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">{label}</span>
                      <span className="truncate text-xs text-green-400">{String(value)}</span>
                    </div>
                  ))}
              </div>
              <pre className="overflow-auto text-xs text-slate-100">
                {JSON.stringify(patch, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "raw" && (
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(rawPayload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </main>
  );
}
