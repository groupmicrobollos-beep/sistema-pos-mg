export async function onRequest(context) {
  const { env, request } = context;

  try {
    if (request.method === 'POST') {
      const product = await request.json();
      const branch_id = 1; // TODO: Obtener de la sesión
      
      // Iniciar una transacción
      const result = await env.DB.prepare(`
        INSERT INTO products (
          id, code, name, description, category, 
          unit, cost, stock, min_stock, max_stock,
          supplier_id, branch_id, alerts, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        product.id || rid('product'),
        product.code || '',
        product.name,
        product.description || '',
        product.category || 'Insumos',
        product.unit || 'u',
        product.cost || 0,
        product.stock || 0,
        product.min_stock || 0,
        product.max_stock || 0,
        product.supplier_id || null,
        branch_id,
        JSON.stringify(product.alerts || {}),
        new Date().toISOString()
      ).run();

      // Si hay stock inicial, crear un movimiento
      if (product.stock > 0) {
        await env.DB.prepare(`
          INSERT INTO stock_movements (
            id, product_id, type, quantity, notes,
            branch_id, created_at
          ) VALUES (?, ?, 'in', ?, 'Stock inicial', ?, ?)
        `).bind(
          rid('mov'),
          result.id,
          product.stock,
          branch_id,
          new Date().toISOString()
        ).run();
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function rid(p = "id") {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
