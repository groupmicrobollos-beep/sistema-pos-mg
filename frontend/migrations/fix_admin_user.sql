-- Actualizar el usuario admin con una contraseña conocida
UPDATE users 
SET password_hash = 'sha256:8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    salt = 'admin_salt',
    email = 'admin@microbollos.com',
    role = 'admin',
    active = 1
WHERE username = 'admin';

-- Si no existe el usuario admin, lo creamos
INSERT OR IGNORE INTO users (
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
    'sha256:8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    'admin_salt',
    'admin',
    'Administrador',
    1,
    1
);
