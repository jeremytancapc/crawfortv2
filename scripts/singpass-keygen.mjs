/**
 * Generates the two EC P-256 key pairs Singpass FAPI 2.0 requires:
 *
 *   sig - signs client assertions (ES256)
 *   enc - decrypts the ID token and the userinfo response (ECDH-ES+A256KW)
 *
 * Singpass requires both: "Your JWKS must have at least one encryption key
 * and one signing key." The public half is what you paste into the SDP; the
 * private half never leaves this machine.
 *
 * Deliberately dependency-free - this runs before `npm install jose`, and a
 * key generator is the last place you want a supply chain.
 *
 * Usage: node scripts/singpass-keygen.mjs [outDir]
 */

import { createHash, generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * RFC 7638 JWK thumbprint, used as the `kid`.
 *
 * The member order below is load-bearing: RFC 7638 hashes the JSON of the
 * required members in lexicographic order with no whitespace. Reordering the
 * keys changes the thumbprint, which changes the kid Singpass looks up.
 */
function thumbprint(jwk) {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return createHash("sha256").update(canonical).digest("base64url");
}

function keyPair({ use, alg }) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  const kid = thumbprint(pub);

  return {
    public: { ...pub, use, alg, kid },
    // `d` is the private scalar. It must never appear in the published JWKS.
    private: { ...priv, use, alg, kid },
  };
}

const outDir = process.argv[2] ?? ".";
mkdirSync(outDir, { recursive: true });

const sig = keyPair({ use: "sig", alg: "ES256" });
const enc = keyPair({ use: "enc", alg: "ECDH-ES+A256KW" });

const publicJwks = { keys: [sig.public, enc.public] };

// Guard against ever shipping a private scalar to Singpass.
for (const key of publicJwks.keys) {
  if ("d" in key) throw new Error(`public JWKS leaked private key material for kid ${key.kid}`);
}

const jwksPath = join(outDir, "singpass-jwks.public.json");
writeFileSync(jwksPath, `${JSON.stringify(publicJwks, null, 2)}\n`);

// One line each, so they drop straight into .env.local as single-line values.
const out = {
  SINGPASS_SIG_PRIVATE_JWK: JSON.stringify(sig.private),
  SINGPASS_ENC_PRIVATE_JWK: JSON.stringify(enc.private),
  publicJwks: JSON.stringify(publicJwks),
  jwksPath,
  sigKid: sig.public.kid,
  encKid: enc.public.kid,
};

if (process.env.SINGPASS_KEYGEN_JSON === "1") {
  process.stdout.write(JSON.stringify(out));
} else {
  console.log(`Public JWKS written to ${jwksPath}`);
  console.log(`  sig kid: ${out.sigKid}`);
  console.log(`  enc kid: ${out.encKid}`);
  console.log("\nPrivate JWKs (for .env.local):\n");
  console.log(`SINGPASS_SIG_PRIVATE_JWK=${out.SINGPASS_SIG_PRIVATE_JWK}`);
  console.log(`SINGPASS_ENC_PRIVATE_JWK=${out.SINGPASS_ENC_PRIVATE_JWK}`);
}
