export async function onRequest(context) {
  const { env, request } = context;

  try {
    if (request.method === 'POST') {
      const supplier = await request.json();
      
      const result = await env.DB.prepare(`
        INSERT INTO suppliers (
          id, name, email, phone, address, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        supplier.id || rid('supplier'),
        supplier.name,
        supplier.email || '',
        supplier.phone || '',
        supplier.address || '',
        supplier.notes || ''
      ).run();

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
