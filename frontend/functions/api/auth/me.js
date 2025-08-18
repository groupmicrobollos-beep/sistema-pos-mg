// /api/auth/me.js

// ===== CORS helpers =====
function cors(req) {
    const origin = req.headers.get("Origin");
    // Si no hay Origin, permitimos cualquier origen (pero sin credentials)
    if (!origin) return {
        "Access-Control-Allow-Origin": "*",
    };
    // Si hay Origin, lo reflejamos y permitimos credentials
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    };
}

function json(d, s = 200, req) {
    const headers = {
        "Content-Type": "application/json",
        ...(req ? cors(req) : {})
    };
    return new Response(JSON.stringify(d), { status: s, headers });
}

// ===== Permisos (alineado a login) =====
function permsFor(role) {
    if (role === "admin")
        return { all: true, inventory: true, quotes: true, settings: true, reports: true, pos: true };
    if (role === "seller")
        return { pos: true, quotes: true, inventory: true };
    return {};
}

// ===== Cookie helper (robusto) =====
function getCookie(req, name) {
    try {
        const cookieHeader = req.headers.get("Cookie");
        if (!cookieHeader) return null;
        
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
        
        return cookies[name] || null;
    } catch (err) {
        console.error("[getCookie] error parsing cookie:", err);
        return null;
    }
}

// ===== Handlers =====
export const onRequestOptions = async ({ request }) =>
    new Response(null, { headers: cors(request) });

export const onRequestGet = async ({ request, env }) => {
    try {
        // 1) Leer cookie 'sid'
        const sid = getCookie(request, "sid");
        if (!sid) {
            console.warn("[me] No session cookie found");
            return json({ error: "No session cookie" }, 401, request);
        }

        // 2) Buscar sesión válida (exp > ahora) + usuario activo
        //    Usamos epoch para evitar problemas de formato de fechas ISO vs datetime('now')
        const sql = `
        SELECT u.id, u.email, u.username, u.role, u.branch_id, u.full_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
          AND CAST(strftime('%s', s.expires_at) AS INTEGER) > CAST(strftime('%s','now') AS INTEGER)
          AND COALESCE(u.active,1) = 1
        LIMIT 1
        `;

        let row;
        try {
            const { results } = await env.DB.prepare(sql).bind(sid).all();
            row = results?.[0];

            if (!row) {
                console.warn("[me] No valid session found for sid:", sid);
                return json({ error: "No session" }, 401, request);
            }

            // 3) Responder usuario + permisos
            const userOut = {
                ...row,
                perms: permsFor(row.role),
            };

            return json(userOut, 200, request);

        } catch (err) {
            console.error("[me] query error", err);
            return json({ error: "Error interno" }, 500, request);
        }
    } catch (err) {
        console.error("[me] unexpected error", err);
        return json({ error: "Error interno" }, 500, request);
    }
};
