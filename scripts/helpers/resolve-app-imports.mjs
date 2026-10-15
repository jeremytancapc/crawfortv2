/**
 * Lets a plain `node` script import the application's TypeScript modules.
 *
 * Application code imports the way the bundler expects - `./income-periods`,
 * `@/lib/loan-form` - and Node's ESM resolver follows neither: it will not
 * guess an extension, and it knows nothing of the tsconfig path alias. Node
 * can strip the types by itself, so resolution is the only gap, and this
 * closes it rather than having support scripts keep a second copy of logic
 * that must not drift from what runs in production.
 *
 * Import this for its side effect, before importing anything from lib/:
 *
 *   import "./helpers/resolve-app-imports.mjs";
 *   const { extractIncome } = await import("../lib/income-extraction.ts");
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/** The first existing file for a path written without an extension. */
function withExtension(base) {
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  for (const extension of EXTENSIONS) {
    const index = resolvePath(base, `index${extension}`);
    if (existsSync(index)) return index;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `@/lib/x` is the tsconfig alias for the repository root.
    const base = specifier.startsWith("@/")
      ? resolvePath(ROOT, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;

    if (base) {
      const found = existsSync(base) && !existsSync(resolvePath(base, "."))
        ? base
        : withExtension(base);
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
