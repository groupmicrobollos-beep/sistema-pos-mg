export async function onRequest(context) {
    const { env, params, request } = context;
    const branch_id = 1; // TODO: Obtener de la sesión

    try {
        if (request.method === 'PUT') {
            const updates = await request.json();
            const { id } = params;
            
            const result = await env.DB.prepare(`
                UPDATE shopping_list 
                SET quantity = ?,
                    notes = ?,
                    supplier_id = ?,
                    updated_at = ?
                WHERE id = ? AND branch_id = ?
            `).bind(
                updates.quantity || 1,
                updates.notes || '',
                updates.supplier_id || null,
                new Date().toISOString(),
                id,
                branch_id
            ).run();

            return new Response(JSON.stringify(result));
        }

        if (request.method === 'DELETE') {
            const { id } = params;
            
            const result = await env.DB.prepare(`
                DELETE FROM shopping_list 
                WHERE id = ? AND branch_id = ?
            `).bind(id, branch_id).run();

            return new Response(JSON.stringify(result));
        }

        return new Response('Method not allowed', { status: 405 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500 
        });
    }
}
