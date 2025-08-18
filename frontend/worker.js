// worker.js

import { getCorsHeaders, json } from './functions/api/utils.js';

// Mapa de rutas a módulos
const ROUTE_MODULES = {
    // Auth
    '/api/auth/login': './functions/api/auth/login.js',
    '/api/auth/logout': './functions/api/auth/logout.js',
    '/api/auth/me': './functions/api/auth/me.js',
    
    // Products
    '/api/products': './functions/api/products/list.js',
    '/api/products/create': './functions/api/products/save.js',
    
    // Quotes
    '/api/quotes': './functions/api/quotes/list.js',
    '/api/quotes/create': './functions/api/quotes/save.js',
    
    // Suppliers
    '/api/suppliers': './functions/api/suppliers/list.js',
    '/api/suppliers/create': './functions/api/suppliers/save.js',
    
    // System & Debug
    '/api/system/health': './functions/api/system/health.js'
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

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // Headers CORS por defecto
        const corsHeaders = {
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        };

        // CORS Preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { 
                headers: getCorsHeaders(request)
            });
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
    },
};
