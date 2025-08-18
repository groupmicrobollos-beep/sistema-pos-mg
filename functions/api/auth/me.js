// /api/auth/me.js
import {
    json,
    getCorsHeaders,
    getCookie,
    validateSession,
    publicUser,
} from '../utils.js';

// Preflight CORS
export const onRequestOptions = async ({ request }) => {
    return new Response(null, { headers: getCorsHeaders(request) });
};

// GET /api/auth/me
export const onRequestGet = async ({ request, env }) => {
    const cors = getCorsHeaders(request);

    try {
        // Leer cookie de sesión
        const sid = getCookie(request, "sid");
        if (!sid) {
            return json({ error: "No session cookie" }, 401, cors);
        }

        // Validar sesión en D1 (usa getSession internamente)
        const sessionUser = await validateSession(env, sid);
        if (!sessionUser) {
            return json({ error: "Invalid or expired session" }, 401, cors);
        }

        // Normalizar salida de usuario público
        const me = publicUser(sessionUser);
        return json(me, 200, cors);

    } catch (err) {
        console.error("[me] Unhandled error:", err?.stack || err);
        return json({ error: "Internal error" }, 500, cors);
    }
};

// Fallback para export default / onRequest (opcional, por compat)
// Si preferís solo onRequestGet, podés borrar esto.
export const onRequest = onRequestGet;
