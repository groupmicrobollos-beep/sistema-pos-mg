import { 
    getCorsHeaders, 
    hashPassword, 
    getCookieConfig,
    generateCookieHeader,
    publicUser,
    verifyPassword,
    createSession
} from '../utils.js';

function permsFor(role) {
    if (role === "admin") return { all: true, inventory: true, quotes: true, settings: true, reports: true, pos: true };
    if (role === "seller") return { pos: true, quotes: true, inventory: true };
    return {};
}

// ====== Request Handlers ======
export const onRequestOptions = async ({ request }) => {
    return new Response(null, {
        headers: getCorsHeaders(request)
    });
};

export const onRequestPost = async ({ request, env }) => {
    // Asegurar que los headers CORS estén presentes
    const corsHeaders = {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };

    let body;
    try {
        body = await request.json();
    } catch (err) {
        return new Response(
            JSON.stringify({ error: "Invalid JSON body" }), 
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        const hashed = await hashPassword(pass, user.salt);
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

    // Obtener el dominio de la request para la cookie
    const domain = new URL(request.url).hostname;
    // Si es localhost o IP, no establecer el dominio
    const cookieDomain = domain.includes("localhost") || /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) 
        ? "" 
        : `; Domain=${domain}`;

    const responseHeaders = {
        ...corsHeaders,
        "Set-Cookie": `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/${cookieDomain}; Max-Age=${TTL_MIN * 60}`,
    };

    return json(userOut, 200, responseHeaders);
};
