CREATE TABLE IF NOT EXISTS solicitudes_profesor (
	usuario_id BIGINT NOT NULL PRIMARY KEY,
	nombre_completo VARCHAR(150) NOT NULL,
	nombre_usuario VARCHAR(50) NOT NULL,
	experiencia TEXT NOT NULL,
	descripcion TEXT NOT NULL,
	motivacion TEXT NOT NULL,
	estudios TEXT NOT NULL,
	imagen_titulo MEDIUMBLOB NULL,
	titulo_mime VARCHAR(32) NULL,
	titulo_nombre VARCHAR(120) NULL,
	estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
	creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT fk_solicitud_profesor_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
