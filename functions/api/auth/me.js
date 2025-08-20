
// Cloudflare Pages: helpers mínimos para CORS y cookies
const ORIGIN = 'https://sistema-pos-mg.pages.dev'; // Cambia por tu frontend real si es otro
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
        'Cache-Control': 'no-store'
    };
}
function parseCookies(request) {
    const raw = request.headers.get('Cookie') || '';
    return raw.split(';').reduce((acc, part) => {
        const [k, v] = part.trim().split('=');
        if (k) acc[k] = v || '';
        return acc;
    }, {});
}

// Cloudflare Pages: GET /api/auth/me
export async function onRequestGet({ request, env }) {
    const hBase = corsHeaders();
    const cookies = parseCookies(request);
    const sid = cookies.sid;
    if (!sid) {
        return new Response(JSON.stringify({ error: 'No session cookie' }), { status: 401, headers: { ...hBase, 'Content-Type': 'application/json' } });
    }
    const raw = await env.KV.get(`sid:${sid}`);
    if (!raw) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...hBase, 'Content-Type': 'application/json' } });
    }
    const session = JSON.parse(raw);
    // Opcional: refrescar TTL aquí si quieres
    const user = { id: session.userId, username: session.username, role: session.role, branch_id: session.branch_id, full_name: session.full_name, email: session.email };
    return new Response(JSON.stringify({ user }), { status: 200, headers: { ...hBase, 'Content-Type': 'application/json' } });
}
