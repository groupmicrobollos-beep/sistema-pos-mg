// functions/api/auth/login.js
import {
  json,
  getCorsHeaders,
  getCookieConfig,
  generateCookieHeader,
  hashPassword,
  publicUser,
  createSession,
  ensureSchema,
} from '../../utils.js';

function userSelect(byEmail) {
  const where = byEmail ? "lower(email)=lower(?)" : "lower(username)=lower(?)";
  return `
    SELECT id, email, username, role, branch_id, full_name, salt, password_hash, COALESCE(active,1) AS active
    FROM users
    WHERE ${where}
    LIMIT 1
  `;
}

// ÚNICO export: onRequest (maneja OPTIONS y POST). Evita 405 raros.
export const onRequest = async ({ request, env }) => {
  const cors = getCorsHeaders(request);
  const method = request.method.toUpperCase();

  // Preflight CORS
  if (method === 'OPTIONS') return new Response(null, { headers: cors });

  // Solo POST
  if (method !== 'POST') return json({ error: 'Method Not Allowed' }, 405, cors);

  try {
    // 1) Body
    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400, cors); }

    const ident = String(body?.identifier || "").trim();
    const pass  = String(body?.password   || "").trim();
    if (!ident || !pass) return json({ error: "Username/email and password are required" }, 400, cors);

    // 2) Usuario
    const byEmail = ident.includes("@");
    let user;
    try {
      const { results } = await env.DB.prepare(userSelect(byEmail)).bind(ident).all();
      user = results?.[0];
    } catch (err) {
      console.error("[login] DB user query error:", err);
      return json({ error: "Internal server error while fetching user" }, 500, cors);
    }
    if (!user || !user.salt || !user.password_hash || user.active !== 1) {
      return json({ error: "Invalid credentials" }, 401, cors);
    }

    // 3) Verificar pass
    try {
      const hashed = await hashPassword(pass, user.salt);
      if (hashed !== user.password_hash) return json({ error: "Invalid credentials" }, 401, cors);
    } catch (err) {
      console.error("[login] Hashing error:", err);
      return json({ error: "Internal server error during authentication" }, 500, cors);
    }

    // 4) sessions
    await ensureSchema(env, "sessions", `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
    `);
    const ttlSec = Number(env?.SESSION_TTL_SECONDS || 60*60*24*30);
    let sid;
    try {
      sid = await createSession(env.DB, user.id, ttlSec);
    } catch (err) {
      console.error("[login] DB session insert error:", err);
      return json({ error: "Internal server error while creating session" }, 500, cors);
    }

    // 5) Cookie
    const cookieCfg = getCookieConfig(request);
    const cookie = generateCookieHeader(sid, cookieCfg, ttlSec);

    // 6) OK
    return json(publicUser(user), 200, { ...cors, "Set-Cookie": cookie });

  } catch (err) {
    console.error("[login] Unhandled error:", err?.stack || err);
    return json({ error: "Internal error" }, 500, cors);
  }
};
