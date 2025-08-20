// scripts/update_passwords.js
import { generateSalt, hashPassword } from '../functions/api/utils.js';

/**
 * Recalcula los hashes de contraseñas para todos los usuarios
 * y los guarda en la base de datos.
 */
export async function updateUserPasswords(env) {
    console.log("[updateUserPasswords] Iniciando actualización de contraseñas...");

    // Obtener todos los usuarios
    const { results } = await env.DB.prepare("SELECT id, username, password FROM users").all();

    if (!results || results.length === 0) {
        console.log("[updateUserPasswords] No se encontraron usuarios.");
        return;
    }

    for (const user of results) {
        try {
            // Generar un nuevo salt
            const salt = await generateSalt();

            // Recalcular hash con PBKDF2
            const passwordHash = await hashPassword(user.password, salt);

            // Guardar en la DB
            await env.DB.prepare(
                "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?"
            ).bind(passwordHash, salt, user.id).run();

            console.log(`[updateUserPasswords] Usuario ${user.username} actualizado.`);
        } catch (err) {
            console.error(`[updateUserPasswords] Error con usuario ${user.username}:`, err);
        }
    }

    console.log("[updateUserPasswords] Finalizado.");
}
