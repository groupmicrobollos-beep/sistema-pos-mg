/**
 * Utilidades de autenticación y manejo de sesiones
 */

// Constantes
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const DEFAULT_SESSION_TTL = 86400; // 24 horas en segundos

/**
 * Genera un salt aleatorio
 * @returns {Promise<string>} Salt en formato hexadecimal
 */
export async function generateSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera un hash PBKDF2 de la contraseña
 * @param {string} password Contraseña en texto plano
 * @param {string} salt Salt en hexadecimal
 * @param {number} iterations Número de iteraciones
 * @returns {Promise<string>} Hash en hexadecimal
 */
export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
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
            iterations: iterations,
            hash: "SHA-256",
        },
        key,
        KEY_LENGTH * 8
    );
    
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verifica una contraseña contra un usuario existente
 * @param {string} password Contraseña a verificar
 * @param {Object} user Usuario de la base de datos
 * @returns {Promise<boolean>} true si la contraseña es correcta
 */
export async function verifyPassword(password, user) {
    const hash = await hashPassword(password, user.salt, user.iterations);
    // Comparación timing-safe
    return crypto.subtle.timingSafeEqual(
        new TextEncoder().encode(hash),
        new TextEncoder().encode(user.password_hash)
    );
}

/**
 * Crea una nueva sesión para un usuario
 * @param {D1Database} db Base de datos D1
 * @param {string} userId ID del usuario
 * @param {number} ttlSec Tiempo de vida de la sesión en segundos
 * @returns {Promise<string>} ID de la sesión
 */
export async function createSession(db, userId, ttlSec = DEFAULT_SESSION_TTL) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    
    await db.prepare(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, userId, expiresAt).run();
    
    return sessionId;
}

/**
 * Obtiene una sesión válida
 * @param {D1Database} db Base de datos D1
 * @param {string} sessionId ID de la sesión
 * @returns {Promise<Object|null>} Sesión si es válida y no expiró
 */
export async function getSession(db, sessionId) {
    const { results } = await db.prepare(`
        SELECT s.*, u.username, u.role, u.full_name, u.email, u.branch_id 
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > datetime('now')
        LIMIT 1
    `).bind(sessionId).all();
    
    return results?.[0] || null;
}

/**
 * Elimina una sesión
 * @param {D1Database} db Base de datos D1
 * @param {string} sessionId ID de la sesión
 */
export async function deleteSession(db, sessionId) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Extrae datos públicos del usuario
 * @param {Object} user Usuario de la base de datos
 * @returns {Object} Datos públicos del usuario
 */
export function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        branch_id: user.branch_id,
    };
}

/**
 * Determina la configuración de cookies según el contexto
 * @param {Request} request Request actual
 * @returns {Object} Configuración de cookies
 */
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

/**
 * Genera el string Set-Cookie con los flags correctos
 * @param {string} sessionId ID de la sesión
 * @param {Object} config Configuración de cookies
 * @param {number} maxAge Tiempo de vida en segundos
 * @returns {string} Header Set-Cookie
 */
export function generateCookieHeader(sessionId, config, maxAge = DEFAULT_SESSION_TTL) {
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

/**
 * Headers CORS consistentes
 * @param {Request} request Request actual
 * @returns {Object} Headers CORS
 */
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

/**
 * Crea un usuario de desarrollo si no existe
 * @param {D1Database} db Base de datos D1
 * @param {Object} userData Datos del usuario
 * @returns {Promise<Object>} Usuario creado o existente
 */
export async function seedUserIfMissing(db, { username, password }) {
    if (!process.env.ENABLE_DEV_CREATE_USER) {
        throw new Error("Development user creation is disabled");
    }

    const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (existing) return existing;

    const userId = crypto.randomUUID();
    const salt = await generateSalt();
    const hash = await hashPassword(password, salt);

    await db.prepare(`
        INSERT INTO users (id, username, password_hash, salt, iterations)
        VALUES (?, ?, ?, ?, ?)
    `).bind(userId, username, hash, salt, PBKDF2_ITERATIONS).run();

    return { id: userId };
}
