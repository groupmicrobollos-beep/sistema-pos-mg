// Utilidades compartidas para todos los endpoints

// Headers CORS consistentes
export function getCorsHeaders(request) {
    const origin = request.headers.get("Origin");
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };
}

// Helper de respuesta JSON
export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 
            "Content-Type": "application/json",
            ...headers
        },
    });
}

// Extractor de cookies seguro
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

// Validador de sesión
export async function validateSession(env, sid) {
    if (!sid) return null;
    
    try {
        const sql = `
            SELECT u.id, u.email, u.username, u.role, u.branch_id, u.full_name
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = ?
              AND CAST(strftime('%s', s.expires_at) AS INTEGER) > CAST(strftime('%s','now') AS INTEGER)
              AND COALESCE(u.active,1) = 1
            LIMIT 1
        `;
        const { results } = await env.DB.prepare(sql).bind(sid).all();
        return results?.[0] || null;
    } catch (err) {
        console.error("[validateSession] Error:", err);
        return null;
    }
}

// Permisos por rol
export function getPermissions(role) {
    if (role === "admin") {
        return { 
            all: true, 
            inventory: true, 
            quotes: true, 
            settings: true, 
            reports: true, 
            pos: true 
        };
    }
    if (role === "seller") {
        return { 
            pos: true, 
            quotes: true, 
            inventory: true 
        };
    }
    return {};
}

// Middleware de autenticación
export async function requireAuth(request, env) {
    const sid = getCookie(request, "sid");
    if (!sid) {
        return json({ error: "No session cookie" }, 401);
    }

    const user = await validateSession(env, sid);
    if (!user) {
        return json({ error: "Invalid or expired session" }, 401);
    }

    return { user, perms: getPermissions(user.role) };
}

// Handler de errores DB
export function handleDbError(err, operation = "database operation") {
    console.error(`[DB Error] ${operation}:`, err);
    return json({ 
        error: "Internal server error",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined 
    }, 500);
}

// Ensure schema helper
export async function ensureSchema(env, table, schema) {
    try {
        await env.DB.prepare(schema).run();
        return true;
    } catch (err) {
        console.warn(`[Schema] Error ensuring ${table}:`, err);
        return false;
    }
}
