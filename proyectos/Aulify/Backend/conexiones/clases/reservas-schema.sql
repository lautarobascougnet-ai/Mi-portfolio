CREATE TABLE IF NOT EXISTS aulify_reservas (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clase_id BIGINT NOT NULL,
    profesor_id BIGINT NOT NULL,
    alumno_id BIGINT NOT NULL,
    inicio DATETIME NOT NULL,
    fin DATETIME NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'EUR',
    estado VARCHAR(20) NOT NULL DEFAULT 'confirmada',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX reserva_profesor_hora (profesor_id, inicio, fin),
    INDEX reserva_alumno_hora (alumno_id, inicio, fin),
    FOREIGN KEY (clase_id) REFERENCES aulify_clases(id) ON DELETE CASCADE,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
