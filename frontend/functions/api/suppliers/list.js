export async function onRequest(context) {
  const { env } = context;
  const sid = context.request.headers.get("Cookie")?.match(/sid=([^;]+)/)?.[1];
  if (!sid) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });

  const session = await env.DB.prepare(`SELECT branch_id FROM sessions WHERE id = ?`).bind(sid).first();
  const branch_id = session?.branch_id;
  if (!branch_id) return new Response(JSON.stringify({ error: "Sucursal no encontrada" }), { status: 404 });
  
  try {
    const suppliers = await env.DB.prepare(`
      SELECT s.*, 
             COUNT(DISTINCT p.id) as product_count,
             SUM(CASE WHEN (p.stock < p.min_stock) THEN 1 ELSE 0 END) as low_stock_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id AND p.branch_id = ?
      WHERE s.branch_id = ?
      GROUP BY s.id
      ORDER BY s.name ASC
    `).bind(branch_id, branch_id).all();

    return new Response(JSON.stringify(suppliers.results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
