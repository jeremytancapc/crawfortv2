import { cookies } from "next/headers";

import {
  APPLY_VARIANT_COOKIE,
  applyPath,
  parseApplyVariant,
  type ApplyVariant,
} from "@/lib/apply-paths";

export async function getApplyVariant(): Promise<ApplyVariant> {
  const store = await cookies();
  return parseApplyVariant(store.get(APPLY_VARIANT_COOKIE)?.value);
}

/** Server redirect target that stays on the current apply variant. */
export async function applyRedirectPath(canonicalPath: string): Promise<string> {
  return applyPath(await getApplyVariant(), canonicalPath);
}
