const PIN_HASH_PREFIX = "pbkdf2";
const PIN_HASH_ITERATIONS = 100_000;
const PIN_HASH_SALT_BYTES = 16;
const PIN_HASH_BITS = 256;

function toHex(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  const clean = hex.trim().toLowerCase();
  if (!clean || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = clean.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (Number.isNaN(value)) return null;
    out[i] = value;
  }
  return out;
}

async function derivePbkdf2(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations,
    },
    key,
    PIN_HASH_BITS
  );
  return toHex(bits);
}

function formatHash(iterations: number, saltHex: string, hashHex: string) {
  return `${PIN_HASH_PREFIX}$${iterations}$${saltHex}$${hashHex}`;
}

function parseHash(stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4) return null;
  const [prefix, iterRaw, saltHex, hashHex] = parts;
  if (prefix !== PIN_HASH_PREFIX) return null;
  const iterations = Number.parseInt(iterRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return null;
  const salt = fromHex(saltHex);
  if (!salt) return null;
  return { iterations, salt, hashHex };
}

async function legacyHashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}

// Hash PBKDF2 (con salt + iteraciones) para PIN.
export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PIN_HASH_SALT_BYTES));
  const hashHex = await derivePbkdf2(pin, salt, PIN_HASH_ITERATIONS);
  return formatHash(PIN_HASH_ITERATIONS, toHex(salt), hashHex);
}

// Verifica PIN contra hash guardado. Soporta hash legado (SHA-256 sin salt).
export async function verifyPin(pin: string, storedHash: string) {
  const parsed = parseHash(storedHash);
  if (parsed) {
    const hashHex = await derivePbkdf2(pin, parsed.salt, parsed.iterations);
    return { ok: hashHex === parsed.hashHex, needsUpgrade: false };
  }
  const legacy = await legacyHashPin(pin);
  const ok = legacy === storedHash;
  return { ok, needsUpgrade: ok };
}
