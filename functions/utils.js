// Utilidades compartidas para todos los endpoints

// Constantes para hashing de contraseñas
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// Función para generar un salt aleatorio
export async function generateSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Función para hash seguro de contraseñas usando PBKDF2
export async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);
    
    const key = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );
    
    const hash = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        key,
        KEY_LENGTH * 8
    );
    
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Función para verificar contraseñas
export async function verifyPassword(password, user) {
    const hash = await hashPassword(password, user.salt);
    // Comparación timing-safe
    return timingSafeEqual(hash, user.password_hash);
}

// Función para comparación timing-safe
function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// Función para crear una sesión
export async function createSession(db, userId, ttlSec = 86400) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    
    await db.prepare(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, userId, expiresAt).run();
    
    return sessionId;
}

// Función para obtener una sesión
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

// Función para eliminar una sesión
export async function deleteSession(db, sessionId) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

// Función para extraer datos públicos del usuario
export function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        perms: permsFor(user.role),
        full_name: user.full_name,
        email: user.email,
        branch_id: user.branch_id
    };
}

// Función para obtener la configuración de cookies
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

// Función para generar el header Set-Cookie
export function generateCookieHeader(sessionId, config, maxAge = 86400) {
    const parts = [
        `sid=${sessionId}`,
        'HttpOnly',
        'Path=/',
        `SameSite=${config.sameSite}`,
    ];

    if (config.isSecure || config.sameSite === 'None') {
        parts.push('Secure');
    }

    if (config.domain && !config.domain.includes('localhost')) {
        parts.push(`Domain=${config.domain}`);
    }

    if (maxAge > 0) {
        parts.push(`Max-Age=${maxAge}`);
    }

    return parts.join('; ');
}

// Headers CORS consistentes
export function getCorsHeaders(request) {
    const origin = request.headers.get("Origin");
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

// Validador de sesión usando KV
export async function validateSession(env, sid) {
    if (!sid) return null;

    try {
        // Obtener sesión del KV
        const sessionData = await env.SESSION_STORE.get(sid);
        if (!sessionData) return null;

        // Parsear datos de la sesión
        const session = JSON.parse(sessionData);

        // Verificar si la sesión ha expirado
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            await env.SESSION_STORE.delete(sid);
            return null;
        }

        return session.user;
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
    });
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
