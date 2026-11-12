CREATE TABLE IF NOT EXISTS aulify_administradores (
	usuario_id BIGINT NOT NULL PRIMARY KEY,
	CONSTRAINT fk_admin_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
