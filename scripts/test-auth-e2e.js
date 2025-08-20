import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const BASE_URL = 'http://localhost:8788';
const TEST_USER = {
    username: 'test_user',
    password: 'secret123'
};

async function fetch(url, options = {}) {
    const response = await globalThis.fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    return response;
}

async function startServer() {
    const server = spawn('wrangler', ['pages', 'dev', '--local'], {
        stdio: 'inherit'
    });

    // Esperar a que el servidor esté listo
    await setTimeout(5000);
    return server;
}

async function runTests() {
    let server;
    try {
        server = await startServer();

        // Test 1: Login
        console.log('\n🔑 Probando login...');
        const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify(TEST_USER)
        });

        if (!loginResponse.ok) {
            throw new Error(`Login falló: ${loginResponse.status}`);
        }

        const cookies = loginResponse.headers.get('Set-Cookie');
        if (!cookies?.includes('sid=')) {
            throw new Error('No se recibió cookie de sesión');
        }

        console.log('✅ Login exitoso');

        // Test 2: Me endpoint
        console.log('\n👤 Probando /me endpoint...');
        const meResponse = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: { Cookie: cookies }
        });

        if (!meResponse.ok) {
            throw new Error(`Me endpoint falló: ${meResponse.status}`);
        }

        console.log('✅ Me endpoint exitoso');

        // Test 3: Logout
        console.log('\n🚪 Probando logout...');
        const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { Cookie: cookies }
        });

        if (!logoutResponse.ok) {
            throw new Error(`Logout falló: ${logoutResponse.status}`);
        }

        const logoutCookies = logoutResponse.headers.get('Set-Cookie');
        if (!logoutCookies?.includes('Max-Age=0')) {
            throw new Error('Cookie no fue expirada correctamente');
        }

        console.log('✅ Logout exitoso');

        // Test 4: Me endpoint después de logout
        console.log('\n🔒 Verificando sesión invalidada...');
        const meAfterLogoutResponse = await fetch(`${BASE_URL}/api/auth/me`);
        
        if (meAfterLogoutResponse.status !== 401) {
            throw new Error('Me endpoint debería retornar 401 después de logout');
        }

        console.log('✅ Sesión invalidada correctamente');
        console.log('\n🎉 Todos los tests pasaron exitosamente!');

    } catch (error) {
        console.error('\n❌ Test fallido:', error.message);
        process.exit(1);
    } finally {
        if (server) {
            server.kill();
        }
    }
}

runTests();
