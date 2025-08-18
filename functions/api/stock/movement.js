// /api/stock/movement.js - Registrar movimientos de stock
export async function onRequestPost({ request, env }) {
    const data = await request.json();
    const { product_id, quantity, type, reference_type, reference_id, notes, user_id, branch_id } = data;

    // Iniciar transacción
    await env.DB.prepare('BEGIN').run();

    try {
        // Registrar movimiento
        await env.DB.prepare(`
            INSERT INTO stock_movements (
                product_id, quantity, type,
                reference_type, reference_id, notes,
                user_id, branch_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            product_id,
            quantity,
            type,
            reference_type,
            reference_id,
            notes,
            user_id,
            branch_id
        ).run();

        // Actualizar stock en productos
        await env.DB.prepare(`
            UPDATE products 
            SET stock = stock + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
            type === 'in' ? quantity : -quantity,
            product_id
        ).run();

        // Commit transacción
        await env.DB.prepare('COMMIT').run();
        
        return new Response(JSON.stringify({ success: true }));

    } catch (error) {
        // Rollback en caso de error
        await env.DB.prepare('ROLLBACK').run();
        throw error;
    }
}
