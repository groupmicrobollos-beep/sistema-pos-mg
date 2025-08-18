// /api/auth/login.js

// ====== CORS & JSON Helpers ======
function getCorsHeaders(request) {
    return {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };
}

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

// ====== Utils ======
async function sha256Hex(s) {
    const b = new TextEncoder().encode(s);
    const d = await crypto.subtle.digest("SHA-256", b);
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function permsFor(role) {
    if (role === "admin") return { all: true, inventory: true, quotes: true, settings: true, reports: true, pos: true };
    if (role === "seller") return { pos: true, quotes: true, inventory: true };
    return {};
}

// ====== Schema helper ======
let sessionsSchemaEnsured = false;
async function ensureSessionsSchema(env) {
    if (sessionsSchemaEnsured) return;
    try {
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL)").run();
        sessionsSchemaEnsured = true;
    } catch (err) {
        console.warn("[login] ensureSessionsSchema warn:", err?.message || err);
    }
}

// ====== Request Handlers ======
export const onRequestOptions = async ({ request }) => {
    return new Response(null, {
        headers: getCorsHeaders(request)
    });
};

export const onRequestPost = async ({ request, env }) => {
    const corsHeaders = getCorsHeaders(request);
    let body;
    try {
        body = await request.json();
    } catch (err) {
        return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const { identifier, password } = body;
    const ident = (identifier || "").trim();
    const pass = (password || "").trim();

    if (!ident || !pass) {
        return json({ error: "Username/email and password are required" }, 400, corsHeaders);
    }

    const byEmail = ident.includes("@");
    const query = byEmail
        ? `SELECT id, email, username, role, branch_id, full_name, salt, password_hash, active FROM users WHERE lower(email)=lower(?) AND COALESCE(active,1)=1 LIMIT 1`
        : `SELECT id, email, username, role, branch_id, full_name, salt, password_hash, active FROM users WHERE lower(username)=lower(?) AND COALESCE(active,1)=1 LIMIT 1`;

    let user;
    try {
        const { results } = await env.DB.prepare(query).bind(ident).all();
        user = results?.[0];
    } catch (err) {
        console.error("[login] DB user query error:", err);
        return json({ error: "Internal server error while fetching user" }, 500, corsHeaders);
    }

    if (!user || !user.salt || !user.password_hash) {
        return json({ error: "Invalid credentials" }, 401, corsHeaders);
    }

    try {
        const hashInput = pass + user.salt;
        const hashed = await sha256Hex(hashInput);
        if (hashed !== user.password_hash) {
            return json({ error: "Invalid credentials" }, 401, corsHeaders);
        }
    } catch (err) {
        console.error("[login] Hashing error:", err);
        return json({ error: "Internal server error during authentication" }, 500, corsHeaders);
    }

    const sid = crypto.randomUUID();
    const TTL_MIN = 60 * 24 * 30; // 30 días
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

    await ensureSessionsSchema(env);
    try {
        await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)").bind(sid, user.id, expiresAt).run();
    } catch (err) {
        console.error("[login] DB session insert error:", err);
        return json({ error: "Internal server error while creating session" }, 500, corsHeaders);
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

    const responseHeaders = {
        ...corsHeaders,
        "Set-Cookie": `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_MIN * 60}`,
    };

    return json(userOut, 200, responseHeaders);
};
