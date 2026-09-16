/**
 * MyInfo payload inspector.
 *
 * Without a query string this is the paste-in debug tool it has always been.
 * With `?rid=<uuid>` it loads a capture that arrived from Singpass and shows
 * it straight away - that is the URL /api/dev/myinfo-capture redirects to.
 *
 * The payload is read here on the server rather than fetched back over HTTP:
 * the page already runs where the database is, and round-tripping unminimised
 * personal data through a second request gains nothing.
 */

import { getMyinfoRetrieval } from "@/lib/db/myinfo-retrievals";
import { isDatabaseConfigured } from "@/lib/db/sql";

import CallbackResultView from "./callback-result-view";

export const dynamic = "force-dynamic";

export default async function CallbackResultPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rid = (await searchParams).rid;
  const retrievalId = typeof rid === "string" ? rid : undefined;

  if (!retrievalId) return <CallbackResultView />;

  if (!isDatabaseConfigured()) {
    return (
      <Notice title="No database configured">
        This deployment has no <code>DATABASE_URL</code>, so captures cannot be read back.
      </Notice>
    );
  }

  let payload: Record<string, unknown> | null = null;
  let failure: string | null = null;
  try {
    payload = await getMyinfoRetrieval(retrievalId);
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  if (failure) {
    return <Notice title="Could not read the capture">{failure}</Notice>;
  }

  if (!payload) {
    return (
      <Notice title="No capture found">
        Nothing is stored under <code>{retrievalId}</code>. A retrieval expires 24 hours
        after it is captured, so this may simply have aged out.
      </Notice>
    );
  }

  return (
    <CallbackResultView
      initialJson={JSON.stringify(payload, null, 2)}
      rid={retrievalId}
    />
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-3 p-6 font-mono text-sm">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
        {children}
      </p>
      <a href="/auth/callback-result" className="text-xs text-blue-600 underline">
        Open the paste-in inspector instead
      </a>
    </main>
  );
}
