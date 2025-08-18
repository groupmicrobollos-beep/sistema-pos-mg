INSERT INTO branches (name, address) VALUES ('Casa Central', 'Córdoba');
INSERT OR IGNORE INTO users (username, email, full_name, role, branch_id, password_hash, salt, active)
VALUES ('admin', 'admin@pos.local', 'Admin', 'admin', 1, 'TO_BE_SET_BY_API', 'TO_BE_SET_BY_API', 1);
