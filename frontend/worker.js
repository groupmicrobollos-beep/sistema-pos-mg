import { getCorsHeaders, json, validateSession, getCookie } from './functions/api/utils.js';

const PROTECTED_PATHS = [
  '/api/products',
  '/api/quotes',
  '/api/suppliers',
  '/api/users'
];

const isProtectedPath = (path) => {
  return PROTECTED_PATHS.some(prefix => path.startsWith(prefix));
};

const worker = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const corsHeaders = getCorsHeaders(request);

      // CORS Preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // Validar sesión para rutas protegidas
      if (isProtectedPath(path)) {
        const sessionId = getCookie(request, "sessionId");
        if (!sessionId) {
          return json({ error: "No session found" }, 401, corsHeaders);
        }

        const session = await validateSession(env, sessionId);
        if (!session) {
          return json({ error: "Invalid session" }, 401, corsHeaders);
        }

        ctx.user = session;
      }

      // Manejo de API
      if (path.startsWith('/api/')) {
        const modulePath = `./functions${path}.js`;
        try {
          const module = await import(modulePath);
          const handler = module[`onRequest${request.method}`] || module.onRequest;

          if (!handler) {
            return json({ error: "Method not allowed" }, 405, corsHeaders);
          }

          const result = await handler(request, env, ctx);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error(`API Error: ${error.message}`);
          return json({ error: "Internal Server Error" }, 500, corsHeaders);
        }
      }

      // Servir archivos estáticos
      if (path.match(/\.(js|css|png|jpg|gif|ico|svg)$/)) {
        try {
          const response = await env.ASSETS.fetch(request);
          return new Response(response.body, {
            status: response.status,
            headers: { ...corsHeaders, ...response.headers }
          });
        } catch {
          return json({ error: "File not found" }, 404, corsHeaders);
        }
      }

      // SPA fallback
      return new Response(
        await env.ASSETS.fetch('/index.html').then(res => res.body),
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );

    } catch (error) {
      console.error('Worker Error:', error);
      return json({ error: "Internal Server Error" }, 500, corsHeaders);
    }
  }
};

// Patrones dinámicos (con IDs)
const DYNAMIC_ROUTES = [
  {
    pattern: /^\/api\/products\/(\d+)$/,
    module: './functions/api/products/[id].js'
  },
  {
    pattern: /^\/api\/quotes\/(\d+)$/,
    module: './functions/api/quotes/[id].js'
  },
  {
    pattern: /^\/api\/suppliers\/(\d+)$/,
    module: './functions/api/suppliers/[id].js'
  }
];

// Removed duplicate export default and fixed try-catch-finally structure
const dynamicWorker = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const corsHeaders = getCorsHeaders(request);

      // CORS Preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // Validar sesión para rutas protegidas
      if (path.startsWith("/api/") &&
        !path.endsWith("/login") &&
        !path.endsWith("/health")) {

        const sessionId = getCookie(request, "sessionId");
        const session = await validateSession(env, sessionId);

        if (!session) {
          return json({ error: "Unauthorized" }, 401, corsHeaders);
        }

        // Agregar usuario al contexto
        ctx.user = session;
      }

      // API Routes
      if (path.startsWith("/api/")) {
        try {
          // 1. Buscar ruta exacta
          let modulePath = ROUTE_MODULES[path];

          // 2. Si no hay match exacto, buscar en rutas dinámicas
          if (!modulePath) {
            const dynamicRoute = DYNAMIC_ROUTES.find(r => r.pattern.test(path));
            if (dynamicRoute) {
              modulePath = dynamicRoute.module;
              // Extraer ID y agregarlo al contexto
              const match = path.match(dynamicRoute.pattern);
              if (match) {
                ctx.params = { id: match[1] };
              }
            }
          }

          if (!modulePath) {
            return json({
              error: "Not Found",
              path: path
            }, 404);
          }

          try {
            const module = await import(modulePath);

            // Determinar el handler basado en el método HTTP
            const handlers = {
              GET: module.onRequestGet || module.onRequest,
              POST: module.onRequestPost,
              PUT: module.onRequestPut,
              DELETE: module.onRequestDelete,
              OPTIONS: module.onRequestOptions
            };

            const handler = handlers[request.method];

            if (handler) {
              return await handler({ request, env, ctx });
            }

            // Si no hay handler para el método, 405 Method Not Allowed
            return json({
              error: "Method not allowed",
              method: request.method,
              allowed: Object.keys(handlers).filter(m => handlers[m])
            }, 405, {
              "Allow": Object.keys(handlers).filter(m => handlers[m]).join(", ")
            });

          } catch (err) {
            console.error(`[API Error] ${path}:`, err);

            // Errores específicos de D1
            if (err.message?.includes("database")) {
              return json({
                error: "Database error",
                detail: process.env.NODE_ENV === "development" ? err.message : undefined
              }, 500);
            }

            // Error general
            return json({
              error: "Internal server error",
              detail: process.env.NODE_ENV === "development" ? err.message : undefined
            }, 500);
          }
        } catch (err) {
          console.error("[Worker Error]:", err);
          return json({
            error: "Worker error",
            detail: process.env.NODE_ENV === "development" ? err.message : undefined
          }, 500);
        }
      }

      // Servir archivos estáticos para rutas no-API
      try {
        const url = new URL(request.url);
        const path = url.pathname;

        // Si es un archivo JavaScript, asegurarse de servir con el tipo MIME correcto
        if (path.endsWith('.js')) {
          const response = await env.ASSETS.fetch(request);

          // Si el archivo existe, servir con el tipo MIME correcto
          if (response.status === 200) {
            const headers = new Headers(response.headers);
            headers.set('Content-Type', 'application/javascript');
            return new Response(response.body, {
              status: 200,
              headers
            });
          }
        }

        // Para archivos CSS
        if (path.endsWith('.css')) {
          const response = await env.ASSETS.fetch(request);
          if (response.status === 200) {
            const headers = new Headers(response.headers);
            headers.set('Content-Type', 'text/css');
            return new Response(response.body, {
              status: 200,
              headers
            });
          }
        }

        // Para la ruta raíz o /index.html
        if (path === '/' || path === '/index.html') {
          const response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
          if (response.status === 200) {
            const headers = new Headers(response.headers);
            headers.set('Content-Type', 'text/html');
            return new Response(response.body, {
              status: 200,
              headers
            });
          }
        }

        // Intenta servir el archivo normalmente
        const response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
          // Si no se encuentra el archivo, servir index.html para SPA
          return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
        }
        return response;

      } catch (err) {
        console.error("[Static Error]:", err);
        return json({
          error: "Static asset error",
          path: path,
          detail: process.env.NODE_ENV === "development" ? err.message : undefined
        }, 500);
      }
    } catch (error) {
      console.error('Worker Error:', error);
      return json({ error: "Internal Server Error" }, 500);
    }
  }
};

export default worker;
