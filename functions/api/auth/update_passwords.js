import { getCorsHeaders, json } from '../../utils.js';
import { updateUserPasswords } from '../../../scripts/update_passwords.js';

export const onRequestPost = async ({ request, env }) => {
    const corsHeaders = getCorsHeaders(request);

    // Verificar que el usuario sea administrador
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

    try {
        await updateUserPasswords(env);
        return json({ message: "Passwords updated successfully" }, 200, corsHeaders);
    } catch (error) {
        console.error("Error updating passwords:", error);
        return json({ error: "Internal server error" }, 500, corsHeaders);
    }
};
