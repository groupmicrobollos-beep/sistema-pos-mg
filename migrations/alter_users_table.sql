-- Agregar columnas de autenticación
ALTER TABLE users ADD COLUMN salt TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
