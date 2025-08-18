// /api/quotes/list.js - Listar presupuestos
export async function onRequestGet({ request, env }) {
    const { results } = await env.DB.prepare(`
        SELECT q.*,
               u.username as created_by,
               b.name as branch_name,
               COUNT(qi.id) as items_count
        FROM quotes q
        LEFT JOIN users u ON u.id = q.user_id
        LEFT JOIN branches b ON b.id = q.branch_id
        LEFT JOIN quote_items qi ON qi.quote_id = q.id
        GROUP BY q.id
        ORDER BY q.created_at DESC
    `).all();
    
    return new Response(JSON.stringify(results || []));
}
