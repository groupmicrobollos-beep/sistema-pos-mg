export async function onRequestGet({ request, env }) {
    const branch_id = 1; // TODO: Obtener de la sesión

    const { results } = await env.DB.prepare(`
        SELECT sl.*,
               p.name as product_name,
               p.unit as product_unit,
               p.min_stock as product_min_stock,
               s.name as supplier_name,
               s.company as supplier_company,
               s.phone as supplier_phone,
               s.email as supplier_email
        FROM shopping_list sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN suppliers s ON sl.supplier_id = s.id
        WHERE sl.branch_id = ?
        ORDER BY sl.created_at DESC
    `).bind(branch_id).all();
    
    return new Response(JSON.stringify(results || []));
}
