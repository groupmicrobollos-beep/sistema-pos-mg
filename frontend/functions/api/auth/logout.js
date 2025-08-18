// /api/auth/logout.js

// Manejador universal para depuración.
export const onRequest = async ({ request, env }) => {
    // Headers de CORS para permitir cualquier origen y método
    const corsHeaders = {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };

    // Manejar solicitud OPTIONS (pre-flight)
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Lógica original de logout
    try {
        const sid = (request.headers.get('Cookie') || '').match(/sid=([^;]+)/)?.[1];
        if (sid) {
            await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();
        }
    } catch (e) {
        console.error("Logout DB error:", e);
        // No bloqueamos al usuario si la DB falla, solo logueamos.
    }

    // Devolver respuesta exitosa con la cookie borrada
    const headers = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Instrucción para que el navegador borre la cookie
        'Set-Cookie': 'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    };

    return new Response(JSON.stringify({ ok: true, message: `Logout successful via ${request.method}` }), {
        status: 200,
        headers: headers
    });
};

