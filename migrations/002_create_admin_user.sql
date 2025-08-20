INSERT INTO users (
    id,
    username,
    password_hash,
    salt,
    iterations,
    role,
    email,
    full_name,
    active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'ef92b778bafe771', -- Contraseña: admin123
    'abcdef0123456789',
    100000,
    'admin',
    'admin@local',
    'Administrador',
    1
);
