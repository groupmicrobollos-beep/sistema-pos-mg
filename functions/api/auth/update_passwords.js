// functions/api/auth/update_passwords.js
import { getCorsHeaders, json } from '../../utils.js';
import { updateUserPasswords } from '../../../scripts/update_passwords.js';

// Endpoint protegido: solo un admin puede ejecutar el reseteo masivo
export async function onRequestPost({ request, env }) {
    const corsHeaders = getCorsHeaders(request);

    try {
        // Verificar token de Authorization
        const auth = request.headers.get("Authorization");
        if (!auth || !auth.startsWith("Bearer ")) {
            return json({ error: "Unauthorized" }, 401, corsHeaders);
        }

        const token = auth.split(" ")[1];
        const session = await env.DB.prepare(
            "SELECT u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?"
        ).bind(token).first();

        if (!session || session.role !== "admin") {
            return json({ error: "Unauthorized" }, 401, corsHeaders);
        }

        // Ejecutar la actualización de contraseñas
        await updateUserPasswords(env);

        return json({ message: "Passwords updated successfully" }, 200, corsHeaders);
    } catch (error) {
        console.error("[update_passwords] Error:", error);
        return json({ error: "Internal server error" }, 500, corsHeaders);
    }
}

// Preflight CORS para evitar bloqueos desde el frontend
export async function onRequestOptions({ request }) {
    const headers = getCorsHeaders(request);
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept';
    return new Response(null, { status: 204, headers });
}
