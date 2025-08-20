export async function onRequest({ request, env }) {
    const method = request.method.toUpperCase();

    if (method === 'GET') {
        const { results } = await env.DB.prepare(
            `SELECT q.*, b.name as branch_name, u.email as user_email
       FROM quotes q
       LEFT JOIN branches b ON b.id = q.branch_id
       LEFT JOIN users u ON u.id = q.user_id
       ORDER BY q.id DESC`
        ).all();
        return Response.json(results || []);
    }

    if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { customer_name, customer_phone, branch_id, user_id, items = [], notes } = body;
        if (!branch_id || !user_id || !Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({ error: 'branch_id, user_id e items[] requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        let total = 0;
        for (const it of items) total += Number(it.quantity) * Number(it.unit_price);

        await env.DB.prepare('BEGIN').run();
        try {
            const q = await env.DB.prepare(
                'INSERT INTO quotes (customer_name, customer_phone, branch_id, user_id, status, total, notes) VALUES (?,?,?,?,?,?,?)'
            ).bind(customer_name ?? null, customer_phone ?? null, branch_id, user_id, 'draft', total, notes ?? null).run();

            const quoteId = q.lastRowId;
            for (const it of items) {
                const subtotal = Number(it.quantity) * Number(it.unit_price);
                await env.DB.prepare(
                    'INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?)'
                ).bind(quoteId, it.product_id, it.quantity, it.unit_price, subtotal).run();
            }

            await env.DB.prepare('COMMIT').run();
            return new Response(JSON.stringify({ ok: true, id: quoteId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            await env.DB.prepare('ROLLBACK').run();
            return new Response(JSON.stringify({ error: 'Server Error', details: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
