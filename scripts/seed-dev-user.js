import { seedUserIfMissing } from '../functions/api/lib/auth.js';

async function main() {
    const { DB } = process.env;
    if (!DB) {
        console.error("DB binding no encontrado. Ejecuta con: wrangler d1 execute <DB_NAME>");
        process.exit(1);
    }

    try {
        await seedUserIfMissing(DB, {
            username: "test_user",
            password: "secret123"
        });
        console.log("Usuario de prueba creado o actualizado exitosamente");
    } catch (error) {
        console.error("Error creando usuario de prueba:", error);
        process.exit(1);
    }
}

main().catch(console.error);
