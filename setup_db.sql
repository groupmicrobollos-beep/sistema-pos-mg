-- Configuración inicial de la base de datos
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Crear tabla de usuarios
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    iterations INTEGER NOT NULL DEFAULT 100000,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role TEXT NOT NULL DEFAULT 'user',
    full_name TEXT,
    email TEXT UNIQUE,
    branch_id INTEGER,
    active INTEGER DEFAULT 1
);

-- Crear tabla de sesiones
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Crear índices necesarios
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Insertar usuario administrador por defecto
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    salt,
    iterations,
    role,
    full_name,
    active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@local',
    'ef92b778bafe771ee8348764e51b82b58b01035b43d3794e6720feef78f256bc',
    'abcdef0123456789',
    100000,
    'admin',
    'Administrador',
    1
);
