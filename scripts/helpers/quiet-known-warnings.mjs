/**
 * Silences two Node warnings that this repo's support scripts always produce
 * and that never mean anything is wrong. Nothing else is suppressed.
 *
 * 1. MODULE_TYPELESS_PACKAGE_JSON - Node notes that a `.ts` file under a
 *    package.json without `"type": "module"` had to be reparsed as ESM. It is
 *    a performance note about the scripts, not about the application, and the
 *    fix it suggests would change how every file in the repo is loaded.
 *
 * 2. pg's SSL-mode notice - a deprecation warning that `sslmode=require` is
 *    currently treated as `verify-full`. It reads like a security problem and
 *    is the opposite: the stricter mode is the one in force, and the
 *    connection string is deliberately left to say what it wants.
 *
 * Both begin with "SECURITY WARNING" or a scary code, and support staff
 * reading a log should not have to learn to ignore them.
 */

const IGNORED = [
  "MODULE_TYPELESS_PACKAGE_JSON",
  "Reparsing as ES module",
  "The SSL modes 'prefer', 'require', and 'verify-ca'",
];

const original = process.emitWarning.bind(process);

process.emitWarning = (warning, ...rest) => {
  const text = `${warning instanceof Error ? warning.message : warning} ${rest.join(" ")}`;
  if (IGNORED.some((phrase) => text.includes(phrase))) return;
  original(warning, ...rest);
};
