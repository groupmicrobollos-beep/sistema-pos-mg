CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
