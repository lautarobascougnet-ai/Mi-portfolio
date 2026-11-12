CREATE TABLE IF NOT EXISTS aulify_clases (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    profesor_id BIGINT NOT NULL,
    materia VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'EUR',
    modalidad VARCHAR(20) NOT NULL,
    horarios MEDIUMTEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (profesor_id),
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
