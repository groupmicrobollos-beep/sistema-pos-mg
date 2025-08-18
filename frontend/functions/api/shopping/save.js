export async function onRequest(context) {
    const { env, request } = context;
    const branch_id = 1; // TODO: Obtener de la sesión

    try {
        if (request.method === 'POST') {
            const item = await request.json();
            
            const result = await env.DB.prepare(`
                INSERT INTO shopping_list (
                    id, product_id, quantity, notes,
                    supplier_id, branch_id, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                item.id || rid('shop'),
                item.product_id,
                item.quantity || 1,
                item.notes || '',
                item.supplier_id || null,
                branch_id,
                new Date().toISOString()
            ).run();

            return new Response(JSON.stringify(result));
        }

        return new Response('Method not allowed', { status: 405 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500 
        });
    }
}

function rid(p = "id") {
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
