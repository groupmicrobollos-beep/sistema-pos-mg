-- Tabla para lista de compra
CREATE TABLE IF NOT EXISTS shopping_list (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    supplier_id TEXT,
    branch_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);
