export async function onRequest({ request, env }) {
    const method = request.method.toUpperCase();

    if (method === 'GET') {
        const { results } = await env.DB.prepare(
            'SELECT * FROM products ORDER BY id DESC'
        ).all();
        return Response.json(results || []);
    }

    if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { name, price, sku, description, cost } = body;
        if (!name || price == null) {
            return new Response(JSON.stringify({ error: 'name y price requeridos' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        const info = await env.DB.prepare(
            'INSERT INTO products (sku, name, price, cost, description) VALUES (?,?,?,?,?)'
        ).bind(sku || null, name, Number(price), cost ?? null, description ?? null).run();

        return new Response(JSON.stringify({ ok: true, id: info.lastRowId }), {
            status: 201, headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
    });
}
