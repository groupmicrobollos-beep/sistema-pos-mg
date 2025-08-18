// /api/debug/dbinfo.js
function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

export async function onRequestGet({ env }) {
    try {
        const dbInfo = {};

        // Contar usuarios
        const usersQuery = await env.DB.prepare("SELECT COUNT(*) as count FROM users").all();
        dbInfo.users = usersQuery.results[0].count;

        // Contar sesiones activas
        const sessionsQuery = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM sessions WHERE CAST(strftime('%s', expires_at) AS INTEGER) > CAST(strftime('%s','now') AS INTEGER)"
        ).all();
        dbInfo.activeSessions = sessionsQuery.results[0].count;

        // Verificar tablas existentes
        const tablesQuery = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).all();
        dbInfo.tables = tablesQuery.results.map(r => r.name);

        // Información de ejemplo de usuario (sin datos sensibles)
        const sampleUserQuery = await env.DB.prepare(
            "SELECT id, email, username, role, branch_id, full_name, active FROM users LIMIT 1"
        ).all();
        dbInfo.sampleUser = sampleUserQuery.results[0] || null;

        return json({
            status: "ok",
            timestamp: new Date().toISOString(),
            database: dbInfo
        });
    } catch (err) {
        console.error("[dbinfo] Error:", err);
        return json({
            status: "error",
            error: err.message || String(err),
            timestamp: new Date().toISOString()
        }, 500);
    }
}
