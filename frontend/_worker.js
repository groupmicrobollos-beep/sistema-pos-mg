// _worker.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Obtener los headers CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin",
    };

    // Manejar las solicitudes OPTIONS (CORS preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Rutas de autenticación
    if (url.pathname === "/api/auth/login") {
      const { onRequestPost, onRequestOptions } = await import("./functions/api/auth/login.js");
      
      if (request.method === "POST") {
        return onRequestPost({ request, env, ctx });
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

    // Si no es una ruta de API, servir archivos estáticos
    return env.ASSETS.fetch(request);
  },
}
