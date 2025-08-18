// Headers de CORS
function getCorsHeaders(request) {
    return {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };
}

// Manejador de OPTIONS para CORS pre-flight
export const onRequestOptions = async ({ request }) => {
    return new Response(null, {
        headers: getCorsHeaders(request)
    });
};

// Manejador de POST para logout
export const onRequestPost = async ({ request, env }) => {
    const corsHeaders = getCorsHeaders(request);

    // Lógica de logout
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
