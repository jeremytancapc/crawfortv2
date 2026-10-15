/**
 * A short label for the prompt and tool schema that produced a model reply.
 *
 * Stored with every reply so a decision can be traced to the exact instructions
 * that were in force - "which prompt was this?" has an answer six months on.
 *
 * Pure JavaScript on purpose. The file that uses it is also pulled into the
 * browser bundle (the upload screen imports from it), where Node's `crypto`
 * does not exist. This is a label, not a security boundary, so a 64-bit hash
 * (cyrb53, run twice over the text) is plenty: twelve hex characters.
 */

function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function versionOf(system: string, toolSchema: unknown): string {
  // The length goes in first so where one part ends and the next begins is
  // part of what is hashed.
  const text = `${system.length}:${system}|${JSON.stringify(toolSchema)}`;
  return (cyrb53(text, 0).toString(16).padStart(14, "0") + cyrb53(text, 1).toString(16).padStart(14, "0")).slice(0, 12);
}
