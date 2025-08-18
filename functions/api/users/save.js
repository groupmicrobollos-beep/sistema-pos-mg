// /api/users/save.js

// ====== CORS ======
function cors(req) {
    const o = req.headers.get("Origin");
    return {
        "Access-Control-Allow-Origin": o || "*",
        "Vary": "Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
}

function json(d, s = 200, req) {
    return new Response(JSON.stringify(d), {
        status: s,
        headers: { "Content-Type": "application/json", ...(req ? cors(req) : {}) },
    });
}

// ====== Utils ======
async function sha256Hex(s) {
    const b = new TextEncoder().encode(s);
    const d = await crypto.subtle.digest("SHA-256", b);
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Validar sesión en la base de datos
async function validateSession(env, sid) {
    const query = `SELECT user_id FROM sessions WHERE id = ? AND expires_at > ? LIMIT 1`;
    const now = new Date().toISOString();
    try {
        const { results } = await env.DB.prepare(query).bind(sid, now).all();
        return results?.[0]?.user_id || null;
    } catch (err) {
        console.error("[users/save] validateSession error:", err);
        return null;
    }
}

// Verificar duplicados de username/email
async function checkDuplicateUser(env, username, email, excludeId = null) {
    const query = `SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ? LIMIT 1`;
    try {
        const { results } = await env.DB.prepare(query).bind(username, email, excludeId || 0).all();
        return results?.length > 0;
    } catch (err) {
        console.error("[users/save] checkDuplicateUser error:", err);
        return true; // Asumir duplicado en caso de error
    }
}

// Generar contraseña aleatoria segura
function generateSecurePassword() {
    return crypto.randomUUID().slice(0, 8); // Ejemplo: 8 caracteres aleatorios
}

export const onRequestOptions = async ({ request }) =>
    new Response(null, { headers: cors(request) });

export const onRequestPost = async ({ request, env }) => {
    // 1) Verificar sesión
    const sid = request.headers.get("Cookie")?.match(/sid=([^;]+)/)?.[1];
    if (!sid) return json({ error: "No autorizado" }, 401, request);

    const userId = await validateSession(env, sid);
    if (!userId) return json({ error: "Sesión inválida o expirada" }, 401, request);

    // 2) Body
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON" }, 400, request);
    }

    const { id, username, email, password, role, full_name, branch_id, active } = body;

    // 3) Validaciones básicas
    if (!username?.trim()) return json({ error: "Username requerido" }, 400, request);
    if (!full_name?.trim()) return json({ error: "Nombre requerido" }, 400, request);
    if (!role) return json({ error: "Rol requerido" }, 400, request);

    const isDuplicate = await checkDuplicateUser(env, username, email, id);
    if (isDuplicate) return json({ error: "Username o email ya existen" }, 400, request);

    try {
        // 4) Si tiene ID, actualizar
        if (id) {
            const updateFields = ["username=?", "email=?", "role=?", "full_name=?", "branch_id=?", "active=?"];
            const params = [username, email || null, role, full_name, branch_id || null, active ? 1 : 0];

            // Si hay password, actualizarlo también
            if (password) {
                const salt = crypto.randomUUID();
                const hash = await sha256Hex(password + (salt || ""));
                updateFields.push("password_hash=?", "salt=?");
                params.push(hash, salt);
            }

            params.push(id); // WHERE id=?

            await env.DB.prepare(`
                UPDATE users 
                SET ${updateFields.join(", ")}
                WHERE id=?
            `).bind(...params).run();

            return json({ success: true, message: "Usuario actualizado" });
        }

        // 5) Si no tiene ID, crear nuevo
        const salt = crypto.randomUUID();
        const generatedPassword = password || generateSecurePassword();
        const hash = await sha256Hex(generatedPassword + salt);

        const { success } = await env.DB.prepare(`
            INSERT INTO users (username, email, password_hash, salt, role, full_name, branch_id, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            username,
            email || null,
            hash,
            salt,
            role,
            full_name,
            branch_id || null,
            active ? 1 : 0
        ).run();

        return json({ 
            success: true, 
            message: "Usuario creado",
            defaultPassword: !password ? generatedPassword : undefined
        });

    } catch (err) {
        console.error("[users/save] error:", err);
        return json({ error: "Error interno" }, 500, request);
    }
};
