export async function onRequest({ env, params }) {
    const id = Number(params.id);
    if (!id) return new Response(JSON.stringify({ error: 'id inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const { results: qRes } = await env.DB.prepare(
        `SELECT q.*, b.name as branch_name, u.email as user_email
     FROM quotes q
     LEFT JOIN branches b ON b.id = q.branch_id
     LEFT JOIN users u ON u.id = q.user_id
     WHERE q.id=?`
    ).bind(id).all();
    const quote = qRes?.[0];
    if (!quote) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const { results: items } = await env.DB.prepare(
        `SELECT qi.*, p.name as product_name, p.sku
     FROM quote_items qi
     LEFT JOIN products p ON p.id = qi.product_id
     WHERE qi.quote_id=?`
    ).bind(id).all();

    return Response.json({ ...quote, items: items || [] });
}
