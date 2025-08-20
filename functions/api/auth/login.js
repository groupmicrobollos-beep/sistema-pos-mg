// functions/api/auth/login.js
// Cloudflare Pages/Functions: helpers mínimos para CORS y cookies
const ORIGIN = 'https://sistema-pos-mg.pages.dev'; // Cambia por tu frontend real si es otro
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  };
}
function setCookieHeaders(sessionId) {
  // Siempre Secure en Pages
  const cookie = `sid=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Secure`;
  return { 'Set-Cookie': cookie };
}
function parseCookies(request) {
  const raw = request.headers.get('Cookie') || '';
  return raw.split(';').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k) acc[k] = v || '';
    return acc;
  }, {});
}

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
      if (!user) {
        // Usuario no encontrado
        return json({ error: "Invalid credentials" }, 401, cors);
      }
    } catch (err) {
      console.error("[login] DB user query error:", err);
      return json({ error: "Invalid credentials" }, 401, cors);
    }
    if (!user.salt || !user.password_hash || user.active !== 1) {
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


    // 5) Cookie y headers CORS manuales (Node.js puro compatible)
    // Detectar si HTTPS real (usar Secure solo si corresponde)
      const url = new URL(request.url);
      return new Response(null, { headers: cors });
    } catch (err) {
      console.error("[login] Unexpected error:", err);
      return json({ error: "Internal server error" }, 500, cors);
    }
  };
  
  // Cloudflare Pages: POST /api/auth/login
  export async function onRequestPost({ request, env }) {
    const hBase = corsHeaders();
    try {
      const body = await request.json();
      const ident = String(body?.identifier || "").trim();
      const pass  = String(body?.password   || "").trim();
      if (!ident || !pass) {
        return new Response(JSON.stringify({ error: "Username/email and password are required" }), { status: 400, headers: { ...hBase, 'Content-Type': 'application/json' } });
      }
      // Buscar usuario (ajusta si tu query es diferente)
      const byEmail = ident.includes("@");
      const { results } = await env.DB.prepare(userSelect(byEmail)).bind(ident).all();
      const user = results?.[0];
      if (!user || !user.salt || !user.password_hash || user.active !== 1) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...hBase, 'Content-Type': 'application/json' } });
      }
      // Verificar password (usa tu hashPassword real)
      const hashed = await hashPassword(pass, user.salt);
      if (hashed !== user.password_hash) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...hBase, 'Content-Type': 'application/json' } });
      }
      // Crear sessionId y guardar en KV
      const sessionId = crypto.randomUUID();
      const ttl = parseInt(env.SESSION_TTL_SECONDS || '2592000', 10); // 30 días por defecto
      await env.KV.put(`sid:${sessionId}`, JSON.stringify({ userId: user.id, username: user.username, role: user.role, branch_id: user.branch_id, full_name: user.full_name, email: user.email }), { expirationTtl: ttl });
      // Responder con cookie y CORS
      const headers = {
        ...hBase,
        ...setCookieHeaders(sessionId),
        'Content-Type': 'application/json'
      };
      const userOut = { id: user.id, username: user.username, role: user.role, branch_id: user.branch_id, full_name: user.full_name, email: user.email };
      return new Response(JSON.stringify({ user: userOut }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { ...hBase, 'Content-Type': 'application/json' } });
    }
  };
