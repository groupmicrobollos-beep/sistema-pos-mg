// /api/quotes/save.js - Crear/actualizar presupuestos
export async function onRequestPost({ request, env }) {
    const data = await request.json();
    const { quote, items } = data;

    // Iniciar transacción
    const { success } = await env.DB.prepare('BEGIN').run();
    if (!success) throw new Error('Failed to begin transaction');

    try {
        let quoteId = quote.id;
        
        if (quoteId) {
            // Actualizar presupuesto existente
            await env.DB.prepare(`
                UPDATE quotes 
                SET customer_name = ?, customer_email = ?, customer_phone = ?,
                    total = ?, status = ?, notes = ?, branch_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(
                quote.customer_name,
                quote.customer_email,
                quote.customer_phone,
                quote.total,
                quote.status,
                quote.notes,
                quote.branch_id,
                quoteId
            ).run();

            // Eliminar items anteriores
            await env.DB.prepare(
                "DELETE FROM quote_items WHERE quote_id = ?"
            ).bind(quoteId).run();
        } else {
            // Crear nuevo presupuesto
            const result = await env.DB.prepare(`
                INSERT INTO quotes (
                    customer_name, customer_email, customer_phone,
                    total, status, notes, branch_id, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                quote.customer_name,
                quote.customer_email,
                quote.customer_phone,
                quote.total,
                quote.status || 'pending',
                quote.notes,
                quote.branch_id,
                quote.user_id
            ).run();
            
            quoteId = result.lastRowId;
        }

        // Insertar nuevos items
        for (const item of items) {
            await env.DB.prepare(`
                INSERT INTO quote_items (
                    quote_id, product_id, quantity, 
                    price, description
                ) VALUES (?, ?, ?, ?, ?)
            `).bind(
                quoteId,
                item.product_id,
                item.quantity,
                item.price,
                item.description
            ).run();
        }

        // Commit transacción
        await env.DB.prepare('COMMIT').run();
        
        return new Response(JSON.stringify({ 
            success: true, 
            quote_id: quoteId 
        }));

    } catch (error) {
        // Rollback en caso de error
        await env.DB.prepare('ROLLBACK').run();
        throw error;
    }
}
