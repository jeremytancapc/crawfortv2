/**
 * Parallel apply funnels for split tests.
 *
 * Canonical paths stay `/` and `/apply/*`. The `v2` variant lives at `/v2`
 * and `/v2/apply/*` and must keep users inside that prefix.
 */
export type ApplyVariant = "default" | "v2";

export const APPLY_VARIANT_COOKIE = "apply_variant";

const VARIANT_PREFIX: Record<ApplyVariant, string> = {
  default: "",
  v2: "/v2",
};

export function parseApplyVariant(value: string | undefined | null): ApplyVariant {
  return value === "v2" ? "v2" : "default";
}

export function normalizeApplyPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function variantFromPathname(pathname: string): ApplyVariant {
  const path = normalizeApplyPathname(pathname);
  return path === "/v2" || path.startsWith("/v2/") ? "v2" : "default";
}

/** Strip `/v2` so funnel matching can use canonical `/` and `/apply/*` paths. */
export function stripVariantPrefix(pathname: string): string {
  const path = normalizeApplyPathname(pathname);
  if (path === "/v2") return "/";
  if (path.startsWith("/v2/")) {
    const rest = path.slice(3);
    return rest.length > 0 ? rest : "/";
  }
  return path;
}

/**
 * Prefix a canonical apply path (`/` or `/apply/review?leadId=`) for a variant.
 */
export function applyPath(variant: ApplyVariant, path: string): string {
  const prefix = VARIANT_PREFIX[variant];
  if (!prefix) return path;

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutHash.indexOf("?");
  const search = qIndex >= 0 ? withoutHash.slice(qIndex) : "";
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;

  const prefixed = pathname === "/" ? prefix : `${prefix}${pathname}`;
  return `${prefixed}${search}${hash}`;
}

export function applyVariantCookie(variant: ApplyVariant) {
  if (variant === "v2") {
    return {
      name: APPLY_VARIANT_COOKIE,
      value: "v2" as const,
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    };
  }
  return {
    name: APPLY_VARIANT_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}
