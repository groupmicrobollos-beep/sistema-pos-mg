import { generateSalt, hashPassword } from '../functions/utils.js';

// Contraseñas conocidas para actualizar
const KNOWN_PASSWORDS = {
    'test_user@pos.local': 'password123',
    'test@example.com': 'test123',
    'admin@local': 'admin123'
};

export async function updateUserPasswords(env) {
    const { results } = await env.DB.prepare(
        "SELECT id, email FROM users WHERE needs_password_update = 1"
    ).all();

    for (const user of results) {
        const password = KNOWN_PASSWORDS[user.email];
        if (!password) {
            console.log(`No se encontró contraseña conocida para ${user.email}`);
            continue;
        }

        const salt = await generateSalt();
        const hash = await hashPassword(password, salt);

        await env.DB.prepare(`
            UPDATE users 
            SET salt = ?, 
                password_hash = ?,
                needs_password_update = 0
            WHERE id = ?
        `).bind(salt, hash, user.id).run();

        console.log(`Actualizada contraseña para ${user.email}`);
    }
}

