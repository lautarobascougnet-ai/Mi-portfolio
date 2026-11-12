<?php
// Instalación aditiva: no reemplaza ni borra tablas existentes.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
$conexion->query(file_get_contents(__DIR__ . '/schema.sql'));
if (!$conexion->query("SHOW COLUMNS FROM aulify_clases LIKE 'horarios'")->num_rows) {
    $conexion->query('ALTER TABLE aulify_clases ADD horarios MEDIUMTEXT NULL');
}
if (!$conexion->query("SHOW COLUMNS FROM aulify_clases LIKE 'moneda'")->num_rows) {
    $conexion->query("ALTER TABLE aulify_clases ADD moneda CHAR(3) NOT NULL DEFAULT 'EUR'");
}
echo "Tabla de clases disponible.\n";
$conexion->query(file_get_contents(__DIR__ . '/reservas-schema.sql'));
if (!$conexion->query("SHOW COLUMNS FROM aulify_reservas LIKE 'moneda'")->num_rows) {
    $conexion->query("ALTER TABLE aulify_reservas ADD moneda CHAR(3) NOT NULL DEFAULT 'EUR'");
}
echo "Tabla de reservas disponible.\n";

require __DIR__ . '/flujo-instalar.php';
