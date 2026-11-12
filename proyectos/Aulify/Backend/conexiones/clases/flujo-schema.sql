CREATE TABLE IF NOT EXISTS aulify_reserva_mensajes (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reserva_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    texto TEXT NOT NULL,
    creado_en DATETIME NOT NULL,
    INDEX (reserva_id, id),
    FOREIGN KEY (reserva_id) REFERENCES aulify_reservas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
