// /api/auth/logout -> POST (borra la sesión)

// Agregamos onRequestGet para depuración. Debería ser solo POST.
export const onRequestGet = async ({ request, env }) => {
    const sid = getCookie(request, 'sid');
    if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();
    return new Response(JSON.stringify({ ok: true, method: 'GET' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' }
    });
};

export const onRequestPost = async ({ request, env }) => {
    const sid = getCookie(request, 'sid');
    if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' }
    });
};
function getCookie(req, name) { const c = req.headers.get('Cookie') || ''; const m = c.match(new RegExp(`${name}=([^;]+)`)); return m ? decodeURIComponent(m[1]) : null; }
