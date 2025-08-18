// /api/auth/login.js
import {
  json,
  getCorsHeaders,
  getCookieConfig,
  generateCookieHeader,
  hashPassword,
  publicUser,
  createSession,
  ensureSchema,
} from '../utils.js';

function userSelect(byEmail) {
  const where = byEmail ? "lower(email)=lower(?)" : "lower(username)=lower(?)";
  return `
    SELECT id, email, username, role, branch_id, full_name, salt, password_hash, COALESCE(active,1) AS active
    FROM users
    WHERE ${where}
    LIMIT 1
  `;
}

export const onRequestOptions = async ({ request }) => {
  return new Response(null, { headers: getCorsHeaders(request) });
};

export const onRequestPost = async ({ request, env }) => {
  const cors = getCorsHeaders(request);

  try {
    // 1) Body JSON
    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400, cors); }

    const ident = String(body?.identifier || "").trim();
    const pass  = String(body?.password   || "").trim();
    if (!ident || !pass) {
      return json({ error: "Username/email and password are required" }, 400, cors);
    }

    // 2) Buscar usuario
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

    // 3) Verificar contraseña
    try {
      const hashed = await hashPassword(pass, user.salt);
      if (hashed !== user.password_hash) {
        return json({ error: "Invalid credentials" }, 401, cors);
      }
    } catch (err) {
      console.error("[login] Hashing error:", err);
      return json({ error: "Internal server error during authentication" }, 500, cors);
    }

    // 4) Asegurar esquema y crear sesión en D1
    try {
      await ensureSchema(env, "sessions", `
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_exp    ON sessions(expires_at);
      `);
    } catch (err) {
      console.warn("[login] ensureSchema sessions warn:", err);
      // seguimos; si existe, no pasa nada
    }

    const ttlSec = Number(env?.SESSION_TTL_SECONDS || 60*60*24*30); // default 30 días
    let sid;
    try {
      sid = await createSession(env.DB, user.id, ttlSec);
    } catch (err) {
      console.error("[login] DB session insert error:", err);
      return json({ error: "Internal server error while creating session" }, 500, cors);
    }

    // 5) Cookie de sesión (consistente con entorno/origen)
    const cookieCfg = getCookieConfig(request);
    const cookie = generateCookieHeader(sid, cookieCfg, ttlSec);

    // 6) Respuesta
    const headers = { ...cors, "Set-Cookie": cookie };
    const out = publicUser(user);
    return json(out, 200, headers);

  } catch (err) {
    console.error("[login] Unhandled error:", err?.stack || err);
    return json({ error: "Internal error" }, 500, cors);
  }
};

// (opcional) compat single-export
export const onRequest = onRequestPost;
