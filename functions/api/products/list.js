// /api/products/list.js - Listar productos
export async function onRequestGet({ request, env }) {
    // Obtener branch_id del usuario autenticado o usar un valor por defecto
    const branch_id = 1; // TODO: Obtener de la sesión

    const { results } = await env.DB.prepare(`
        SELECT p.*, 
               s.name as supplier_name,
               s.company as supplier_company,
               COALESCE(SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE -sm.quantity END), 0) as stock_real
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.branch_id = ?
        WHERE p.branch_id = ?
        GROUP BY p.id
        ORDER BY p.name
    `).bind(branch_id, branch_id).all();
    
    return new Response(JSON.stringify(results || []));
}
