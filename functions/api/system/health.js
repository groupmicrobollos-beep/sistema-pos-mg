// functions/api/system/health.js
import { json, getCorsHeaders, validateSession, getCookie } from '../utils.js';

export async function onRequestGet({ request, env }) {
    const corsHeaders = getCorsHeaders(request);
    
    try {
        const health = {
            status: "ok",
            timestamp: new Date().toISOString(),
            components: {}
        };

        // 1. Verificar DB
        try {
            const dbStatus = await checkDatabase(env);
            health.components.database = dbStatus;
        } catch (err) {
            health.components.database = {
                status: "error",
                error: err.message
            };
        }

        // 2. Verificar sesión actual
        try {
            const sid = getCookie(request, "sid");
            if (sid) {
                const session = await validateSession(env, sid);
                health.components.session = {
                    status: "ok",
                    active: !!session,
                    expires: session ? "valid" : "expired"
                };
            } else {
                health.components.session = {
                    status: "ok",
                    active: false
                };
            }
        } catch (err) {
            health.components.session = {
                status: "error",
                error: err.message
            };
        }

        // 3. Verificar CORS
        health.components.cors = {
            status: "ok",
            origin: request.headers.get("Origin") || "no origin",
            credentials: request.headers.get("Cookie") ? "present" : "absent"
        };

        // Estado general
        health.status = Object.values(health.components)
            .every(c => c.status === "ok") ? "ok" : "degraded";

        return json(health, 200, corsHeaders);
    } catch (err) {
        console.error("[health] Error:", err);
        return json({
            status: "error",
            error: err.message,
            timestamp: new Date().toISOString()
        }, 500, corsHeaders);
    }
}

// Preflight para CORS
export async function onRequestOptions({ request }) {
    const headers = getCorsHeaders(request);
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept';
    return new Response(null, { status: 204, headers });
}

async function checkDatabase(env) {
    const tables = ["users", "sessions", "products", "quotes", "suppliers"];
    const status = {
        status: "ok",
        tables: {},
        counts: {}
    };

    for (const table of tables) {
        try {
            const { results } = await env.DB.prepare(
                `SELECT COUNT(*) as count FROM ${table}`
            ).all();
            status.counts[table] = results[0].count;
            status.tables[table] = "ok";
        } catch (err) {
            status.tables[table] = "error";
            status.status = "error";
        }
    }

    return status;
}
