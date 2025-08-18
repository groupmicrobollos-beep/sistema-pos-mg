// /api/auth/login.js

// ====== CORS ======
function cors(req) {
    const o = req.headers.get("Origin");
    // Nota: con credenciales, lo ideal es eco del Origin real.
    return {
        "Access-Control-Allow-Origin": o || "*",
        "Vary": "Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
}

// Respuesta JSON (si pasás request, agrega CORS)
function json(d, s = 200, req) {
    return new Response(JSON.stringify(d), {
        status: s,
        headers: { "Content-Type": "application/json", ...(req ? cors(req) : {}) },
    });
}

// ====== Utils ======
async function sha256Hex(s) {
    const b = new TextEncoder().encode(s);
    const d = await crypto.subtle.digest("SHA-256", b);
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function permsFor(role) {
    if (role === "admin")
        return { all: true, inventory: true, quotes: true, settings: true, reports: true, pos: true };
    if (role === "seller")
        return { pos: true, quotes: true, inventory: true };
    return {};
}

// ====== Schema helper (evita 500 si aún no existe sessions) ======
let sessionsSchemaEnsured = false;
async function ensureSessionsSchema(env) {
    if (sessionsSchemaEnsured) return;
    try {
        await env.DB.prepare(
            "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL)"
        ).run();
        await env.DB.prepare(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
        ).run();
        await env.DB.prepare(
            "CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at)"
        ).run();
        sessionsSchemaEnsured = true;
    } catch (err) {
        // No rompemos el flujo por error de DDL; solo dejamos log
        console.warn("[login] ensureSessionsSchema warn:", err?.message || err);
    }
}

// Validar datos del usuario
function validateUserData(user) {
    if (!user || !user.salt || !user.password_hash) {
        console.warn("[login] Datos de usuario inválidos:", user);
        return false;
    }
    return true;
}

// ====== Handlers ======
export const onRequestOptions = async ({ request }) =>
    new Response(null, { headers: cors(request) });

export const onRequestPost = async ({ request, env }) => {
    // 1) Body
    let body;
    try {
        body = await request.json();
        console.log("[login] Body recibido:", body);
    } catch (err) {
        console.error("[login] Error al parsear JSON del body:", err);
        return json({ error: "JSON inválido" }, 400, request);
    }

    const { identifier, email, password } = body;
    const identRaw = (identifier ?? email ?? "").trim();
    const ident = identRaw.includes("@") ? identRaw.toLowerCase() : identRaw;
    const pass = (password ?? "").trim();

    console.log("[login] Identificador procesado:", ident);
    if (!ident || !pass) {
        console.warn("[login] Usuario/email o contraseña faltantes");
        return json({ error: "Usuario/email y contraseña requeridos" }, 400, request);
    }

    // 2) Buscar usuario
    const byEmail = ident.includes("@");
    const query = byEmail
        ? `SELECT id,email,username,role,branch_id,full_name,salt,password_hash,active
           FROM users
           WHERE lower(email)=lower(?) AND COALESCE(active,1)=1
           LIMIT 1`
        : `SELECT id,email,username,role,branch_id,full_name,salt,password_hash,active
           FROM users
           WHERE lower(username)=lower(?) AND COALESCE(active,1)=1
           LIMIT 1`;

    let user;
    try {
        const { results } = await env.DB.prepare(query).bind(ident).all();
        user = results?.[0];
        console.log("[login] Usuario encontrado:", user);
    } catch (err) {
        console.error("[login] Error en la consulta SQL:", err);
        return json({ error: "Error interno al buscar usuario" }, 500, request);
    }

    if (!validateUserData(user)) {
        console.warn("[login] Datos de usuario inválidos:", user);
        return json({ error: "Credenciales inválidas (usuario)" }, 401, request);
    }

    // 3) Verificar contraseña
    try {
        const hashInput = pass + user.salt;
        const hashed = await sha256Hex(hashInput);
        console.log("[login] Hash calculado:", hashed);
        console.log("[login] Hash esperado:", user.password_hash);
        if (hashed !== user.password_hash) {
            console.warn("[login] Hash no coincide:", { hashed, expected: user.password_hash, input: hashInput });
            return json({ error: "Credenciales inválidas (contraseña)" }, 401, request);
        }
    } catch (err) {
        console.error("[login] Error al calcular hash:", err);
        return json({ error: "Error interno al verificar contraseña" }, 500, request);
    }

    // 4) Crear sesión
    const sid = crypto.randomUUID();
    const TTL_MIN = 60 * 24 * 30; // 30 días
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();
    console.log("[login] Creando sesión con SID:", sid);
    await ensureSessionsSchema(env);
    try {
        await env.DB.prepare(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)"
        ).bind(sid, user.id, expiresAt).run();
        console.log("[login] Sesión creada con éxito:", { sid, userId: user.id, expiresAt });
    } catch (err) {
        console.error("[login] Error al insertar sesión:", err);
        return json({ error: "Error interno al crear sesión" }, 500, request);
    }

    const userOut = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        full_name: user.full_name,
        perms: permsFor(user.role),
    };
    console.log("[login] Respuesta final al cliente:", userOut);
    return new Response(JSON.stringify(userOut), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            ...cors(request),
            "Set-Cookie": `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_MIN * 60}`,
        },
    });
};
