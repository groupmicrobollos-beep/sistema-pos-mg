// /api/auth/logout.js
import {
    json,
    getCorsHeaders,
    getCookie,
} from '../utils.js';

// Preflight para CORS
export const onRequestOptions = async ({ request }) => {
    return new Response(null, { headers: getCorsHeaders(request) });
};

// POST /api/auth/logout
export const onRequestPost = async ({ request, env }) => {
    const cors = getCorsHeaders(request);

    try {
        // 1) Obtener SID desde cookie
        const sid = getCookie(request, "sid");

        // 2) Borrar sesión en D1 (si existe)
        if (sid && env?.DB) {
            try {
                await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
            } catch (err) {
                console.error("[logout] DB delete error:", err);
                // no impedimos el logout; continuamos borrando cookie
            }
        }

        // 3) Armar cookie expirada con atributos consistentes
        const url = new URL(request.url);
        const host = url.hostname;
        const isLocalhost = url.protocol === 'http:' || host.includes('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

        // Nota: en localhost, Secure puede evitar que el navegador borre/guarde cookies.
        // Si usás http://localhost, considerá correr con https en dev o quitar Secure condicionalmente.
        const parts = [
            'sid=',
            'HttpOnly',
            'Path=/',
            'SameSite=Lax',
            'Max-Age=0', // expira inmediatamente
        ];
        if (!isLocalhost) parts.push('Secure');     // en prod/https
        if (!isLocalhost) parts.push(`Domain=${host}`);

        const headers = {
            ...cors,
            'Set-Cookie': parts.join('; '),
        };

        return json({ ok: true }, 200, headers);

    } catch (err) {
        console.error("[logout] Unhandled error:", err?.stack || err);
        // igual devolvemos cookie expirada para asegurar logout del lado del browser
        const url = new URL(request.url);
        const host = url.hostname;
        const isLocalhost = url.protocol === 'http:' || host.includes('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
        const parts = [
            'sid=',
            'HttpOnly',
            'Path=/',
            'SameSite=Lax',
            'Max-Age=0',
        ];
        if (!isLocalhost) parts.push('Secure');
        if (!isLocalhost) parts.push(`Domain=${host}`);

        return json({ ok: true }, 200, { ...getCorsHeaders(request), 'Set-Cookie': parts.join('; ') });
    }
};

// Fallback por compatibilidad (opcional)
export const onRequest = onRequestPost;
