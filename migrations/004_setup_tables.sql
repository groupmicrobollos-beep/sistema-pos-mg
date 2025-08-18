-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    branch_id INTEGER,
    full_name TEXT,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active INTEGER DEFAULT 1
);

-- Crear tabla de sesiones
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT NOT NULL,
    cost REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER DEFAULT 0,
    supplier_id INTEGER,
    alerts TEXT,
    updated_at TEXT,
    branch_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_code ON products(code);

-- Crear tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    tags TEXT,
    notes TEXT,
    updated_at TEXT,
    branch_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Crear tabla de presupuestos
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL
);

-- Crear tabla de sucursales
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL
);

-- Crear tabla de reportes
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Crear tabla de inventario
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    branch_id INTEGER,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Insertar datos de prueba
INSERT OR IGNORE INTO users (id, email, username, role, branch_id, full_name, salt, password_hash, active)
VALUES (1, 'admin@pos.local', 'admin', 'admin', 1, 'Administrador', 'random_salt', 'e3afed0047b08059d0fada10f400c1e5', 1);

INSERT OR IGNORE INTO branches (id, name, location)
VALUES (1, 'Sucursal Central', 'Av. Principal 123');

INSERT OR IGNORE INTO inventory (id, name, quantity, price, branch_id)
VALUES (1, 'Producto A', 100, 50.0, 1);

INSERT OR IGNORE INTO quotes (id, customer_name, total, created_at)
VALUES (1, 'Cliente Prueba', 150.0, '2025-08-15T00:00:00Z');

INSERT OR IGNORE INTO reports (id, title, content, created_at)
VALUES (1, 'Reporte Inicial', 'Contenido del reporte', '2025-08-15T00:00:00Z');
