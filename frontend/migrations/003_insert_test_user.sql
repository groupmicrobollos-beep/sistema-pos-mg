-- Eliminar el usuario admin si existe
DELETE FROM users WHERE username = 'admin';

-- Crear el usuario admin desde cero
INSERT INTO users (
    username,
    email,
    password_hash,
    salt,
    role,
    full_name,
    branch_id,
    active
) VALUES (
    'admin',
    'admin@microbollos.com',
    'admin',  -- Contraseña simple para pruebas
    'no_salt',
    'admin',
    'Administrador',
    1,
    1
);
