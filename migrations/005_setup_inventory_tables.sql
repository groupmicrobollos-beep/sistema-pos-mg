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
    branch_id INTEGER,
    updated_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Asegurarnos que products tenga la estructura correcta
DROP TABLE IF EXISTS products;
CREATE TABLE products (
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
    supplier_id TEXT,
    branch_id INTEGER,
    alerts TEXT,
    updated_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Crear tabla para lista de compras
CREATE TABLE IF NOT EXISTS shopping_list (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    supplier_id TEXT,
    branch_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (item_id) REFERENCES products(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_branch ON suppliers(branch_id);
CREATE INDEX IF NOT EXISTS idx_shopping_branch ON shopping_list(branch_id);
