/**
 * Writes down what shape.ts finds, where it can be queried:
 *
 *   select created_at, error as codes, response_body
 *     from api_logs where tag = '[ascend-shape]' order by created_at desc;
 *
 * and as a warning in the server log. Never throws and never changes what the
 * caller does - a monitor that can break the call it watches is worse than none.
 */

import { logExternalApi } from "@/lib/external-api-logger";

import { shapeProblems } from "./shape";

export const SHAPE_LOG_TAG = "[ascend-shape]";

export function reportShape(path: string, url: string, data: unknown, applicantId?: string | null): void {
  try {
    const problems = shapeProblems(path, data);
    if (problems.length === 0) return;

    console.warn(`${SHAPE_LOG_TAG} ${path}: ${problems.map((p) => `${p.severity} ${p.code} (${p.detail})`).join("; ")}`);
    logExternalApi({
      tag: SHAPE_LOG_TAG,
      url,
      method: "POST",
      headers: {},
      body: { path, problems },
      status: 200,
      ok: true,
      ms: 0,
      responseBody: JSON.stringify(data).slice(0, 2000),
      // The codes go in `error`, so a plain GROUP BY counts them.
      error: problems.map((p) => p.code).join(","),
      ...(applicantId ? { leadId: applicantId } : {}),
    });
  } catch (err) {
    console.error(`${SHAPE_LOG_TAG} could not check a reply`, err);
  }
}
