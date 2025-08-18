-- Inserta un usuario de prueba en la tabla `users`
INSERT OR IGNORE INTO users (id, email, username, role, branch_id, full_name, salt, password_hash, active)
VALUES (
    1, 
    'admin@pos.local', 
    'admin', 
    'admin', 
    1, 
    'Administrador', 
    'random_salt', 
    'e3afed0047b08059d0fada10f400c1e5', -- Hash de "password" + "random_salt"
    1
);
