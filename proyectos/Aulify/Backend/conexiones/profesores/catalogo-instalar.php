<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
// Migración aditiva: no borra clases ni solicitudes existentes.
foreach (['materia' => 'VARCHAR(100) NULL', 'email_solicitud' => 'VARCHAR(254) NULL'] as $column => $type) {
    if (!$conexion->query("SHOW COLUMNS FROM solicitudes_profesor LIKE '$column'")->num_rows) $conexion->query("ALTER TABLE solicitudes_profesor ADD $column $type");
}
$conexion->query("CREATE TABLE IF NOT EXISTS aulify_materias (id BIGINT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE, estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', solicitado_por BIGINT NULL, revisado_por BIGINT NULL, motivo TEXT NULL, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, revisado_en DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$conexion->query("CREATE TABLE IF NOT EXISTS aulify_correos (id BIGINT AUTO_INCREMENT PRIMARY KEY, evento VARCHAR(100) NOT NULL UNIQUE, destinatario VARCHAR(254) NOT NULL, asunto VARCHAR(200) NOT NULL, cuerpo TEXT NOT NULL, estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP, enviado_en DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
foreach (['Matemáticas','Inglés','Dibujo','Derecho','Francés','Programación','Biología','Historia','Economía'] as $name) {
    $conexion->execute_query("INSERT IGNORE INTO aulify_materias (nombre,estado) VALUES (?,'aprobada')", [$name]);
}
// Conserva las materias que ya tenían clases antes de esta migración.
$conexion->query("INSERT IGNORE INTO aulify_materias (nombre,estado) SELECT DISTINCT materia,'aprobada' FROM aulify_clases");
echo "Catálogo y cola de correos preparados.\n";
