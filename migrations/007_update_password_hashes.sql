-- Esta migración actualiza el esquema de hashing de contraseñas
-- La actualización real de los hashes se hará a través de la aplicación

-- Asegurarse de que los campos salt y password_hash existan y sean del tamaño correcto
ALTER TABLE users MODIFY COLUMN salt VARCHAR(32) NOT NULL;
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(64) NOT NULL;

-- Agregar un campo temporal para marcar usuarios que necesitan actualización de hash
ALTER TABLE users ADD COLUMN needs_password_update BOOLEAN DEFAULT 1;

-- Marcar todos los usuarios existentes para actualización
UPDATE users SET needs_password_update = 1;
