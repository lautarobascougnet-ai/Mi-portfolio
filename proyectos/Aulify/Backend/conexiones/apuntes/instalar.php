<?php
// Migración aditiva, disponible únicamente desde consola.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
foreach (explode(';', file_get_contents(__DIR__ . '/schema.sql')) as $sql) {
    if (trim($sql) !== '') $conexion->query($sql);
}
echo "Carpetas y apuntes disponibles.\n";
