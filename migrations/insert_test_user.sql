-- Insertar usuario de prueba
INSERT INTO users (username, email, role, full_name, salt, password_hash)
VALUES (
    'test',
    'test@example.com',
    'admin',
    'Usuario de Prueba',
    '123456',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' -- hash de 'password123'
);
