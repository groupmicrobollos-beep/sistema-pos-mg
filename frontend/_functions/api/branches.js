export async function onRequest({ request, env }) {
    const method = request.method.toUpperCase();

    if (method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM branches ORDER BY id ASC').all();
        return Response.json(results || []);
    }

    if (method === 'POST') {
        const b = await request.json().catch(() => ({}));
        if (!b.name) return new Response(JSON.stringify({ error: 'name requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        const info = await env.DB.prepare('INSERT INTO branches (name, address) VALUES (?,?)')
            .bind(b.name, b.address ?? null).run();
        return new Response(JSON.stringify({ ok: true, id: info.lastRowId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
