// functions/api/utils.js

// --- Constantes hashing ---
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// --- Salt y hash (Web Crypto) ---
export async function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LENGTH * 8
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function verifyPassword(password, user) {
  const hash = await hashPassword(password, user.salt);
  return timingSafeEqual(hash, user.password_hash);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// --- Sesión en D1 (si la usás) ---
export async function createSession(db, userId, ttlSec = 86400) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, userId, expiresAt).run();
  return sessionId;
}
export async function getSession(db, sessionId) {
  const { results } = await db.prepare(`
    SELECT s.*, u.* 
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(sessionId).all();
  return results?.[0] || null;
}
export async function deleteSession(db, sessionId) {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

// --- Usuario público / permisos ---
export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    perms: getPermissions(user.role),
    full_name: user.full_name,
    email: user.email,
    branch_id: user.branch_id
  };
}
export function getPermissions(role) {
  if (role === "admin") return { all:true, inventory:true, quotes:true, settings:true, reports:true, pos:true };
  if (role === "seller") return { pos:true, quotes:true, inventory:true };
  return {};
}

// --- Cookies & CORS ---
export function getCookieConfig(request) {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const isLocalHttp = url.protocol === 'http:' || url.hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
  const isCrossSite = origin && new URL(origin).hostname !== url.hostname;
  return {
    isSecure: !isLocalHttp,
    sameSite: isCrossSite ? 'None' : 'Lax',
    domain: isLocalHttp ? undefined : url.hostname,
  };
}
export function generateCookieHeader(sessionId, config, maxAge = 86400) {
  const parts = [`sid=${sessionId}`, 'HttpOnly', 'Path=/', `SameSite=${config.sameSite}`];
  if (config.isSecure || config.sameSite === 'None') parts.push('Secure');
  if (config.domain && !config.domain.includes('localhost')) parts.push(`Domain=${config.domain}`);
  if (maxAge > 0) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}
// ⚠️ Con credenciales NO usar "*": reflejamos el Origin
export function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || '';
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}
export function getCookie(request, name) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch (err) {
    console.error(`[getCookie] Error parsing ${name}:`, err);
    return null;
  }
}

// --- Sesión en KV (aliasa SESSION_STORE o KV) ---
export async function validateSession(env, sid) {
  if (!sid) return null;
  try {
    const KV = env.SESSION_STORE || env.KV;
    const sessionData = await KV.get(sid);
    if (!sessionData) return null;
    const session = JSON.parse(sessionData);
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      await KV.delete(sid);
      return null;
    }
    return session.user;
  } catch (err) {
    console.error("[validateSession] Error:", err);
    return null;
  }
}

// --- Middleware / errores ---
export async function requireAuth(request, env) {
  const sid = getCookie(request, "sid");
  if (!sid) return json({ error: "No session cookie" }, 401, getCorsHeaders(request));
  const user = await validateSession(env, sid);
  if (!user) return json({ error: "Invalid or expired session" }, 401, getCorsHeaders(request));
  return { user, perms: getPermissions(user.role) };
}
export function handleDbError(err, operation = "database operation") {
  console.error(`[DB Error] ${operation}:`, err);
  return json({ error: "Internal server error" }, 500);
}
export async function ensureSchema(env, table, schema) {
  try { await env.DB.prepare(schema).run(); return true; }
  catch (err) { console.warn(`[Schema] Error ensuring ${table}:`, err); return false; }
}
