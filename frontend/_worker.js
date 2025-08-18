// _worker.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || url.origin;

    // Headers CORS base
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };

    // Manejar preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Manejar rutas de API
    if (url.pathname.startsWith("/api/")) {
      // Rutas de autenticación
      if (url.pathname === "/api/auth/login") {
        const { onRequestPost, onRequestOptions } = await import("./functions/api/auth/login.js");
        
        if (request.method === "POST") {
          const response = await onRequestPost({ request, env, ctx });
          // Asegurar que los headers CORS estén presentes en la respuesta
          const headers = new Headers(response.headers);
          Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
          return new Response(response.body, {
            status: response.status,
            headers
          });
        }
        
        if (request.method === "OPTIONS") {
          return onRequestOptions({ request });
        }

        return new Response("Method not allowed", { 
          status: 405,
          headers: {
            ...corsHeaders,
            "Allow": "POST, OPTIONS"
          }
        });
      }

      // Otras rutas de API aquí...
      return new Response("Not found", { 
        status: 404,
        headers: corsHeaders
      });
    }

    // Servir archivos estáticos o SPA fallback
    try {
      // Intentar servir el archivo solicitado
      let response = await env.ASSETS.fetch(request);
      
      // Si el archivo no existe y es una ruta que podría ser del SPA
      if (response.status === 404 && !url.pathname.startsWith('/api/') && !url.pathname.match(/\.(js|css|png|jpg|gif|svg|ico)$/)) {
        // Servir index.html para rutas del SPA
        response = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, request));
      }

      // Si aún así es 404 y termina en .js, intentar buscar en la carpeta js
      if (response.status === 404 && url.pathname.endsWith('.js')) {
        const jsPath = url.pathname.startsWith('/js/') ? url.pathname : `/js${url.pathname}`;
        response = await env.ASSETS.fetch(new Request(`${url.origin}${jsPath}`, request));
      }

      // Agregar headers CORS a la respuesta
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      
      // Asegurar que los archivos JavaScript se sirvan con el tipo MIME correcto
      if (url.pathname.endsWith('.js')) {
        headers.set('Content-Type', 'application/javascript');
      }

      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (err) {
      console.error('Error serving static file:', err);
      return new Response("Not found", { 
        status: 404,
        headers: corsHeaders
      });
    }
  },
}
