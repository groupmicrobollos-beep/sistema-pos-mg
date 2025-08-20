export async function onRequest(context) {
  const { env, params, request } = context;

  try {
    if (request.method === 'PUT') {
      const updates = await request.json();
      const { id } = params;
      
      let query = 'UPDATE suppliers SET ';
      const values = [];
      const fields = [];

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return new Response('No fields to update', { status: 400 });
      }

      query += fields.join(', ');
      query += ' WHERE id = ?';
      values.push(id);

      const result = await env.DB.prepare(query).bind(...values).run();

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      const { id } = params;
      
      const result = await env.DB.prepare(`
        DELETE FROM suppliers WHERE id = ?
      `).bind(id).run();

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
