export async function onRequest({ request, env, params }) {
    const id = Number(params.id);
    if (!id) return new Response(JSON.stringify({ error: 'id inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const method = request.method.toUpperCase();

    if (method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).all();
        const row = results?.[0] || null;
        return row ? Response.json(row) : new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'PUT') {
        const b = await request.json().catch(() => ({}));
        const { name, price, sku, description, cost } = b;
        await env.DB.prepare(
            'UPDATE products SET sku=?, name=?, price=?, cost=?, description=?, updated_at=datetime("now") WHERE id=?'
        ).bind(sku ?? null, name, Number(price), cost ?? null, description ?? null, id).run();
        return Response.json({ ok: true });
    }

    if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();
        return Response.json({ ok: true });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
