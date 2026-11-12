CREATE TABLE IF NOT EXISTS aulify_carpetas (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion LONGTEXT NOT NULL,
    INDEX (usuario_id, id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aulify_apuntes (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    carpeta_id BIGINT NULL,
    nombre TEXT NOT NULL,
    descripcion LONGTEXT NOT NULL,
    contenido LONGTEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (usuario_id, carpeta_id, id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (carpeta_id) REFERENCES aulify_carpetas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
