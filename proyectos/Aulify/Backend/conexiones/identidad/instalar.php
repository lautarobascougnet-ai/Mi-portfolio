<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
// Solo añade tablas nuevas; no reemplaza usuarios ni modifica sus datos.
foreach (explode(';', file_get_contents(__DIR__ . '/schema.sql')) as $sql) {
	if (trim($sql) !== '') $conexion->query($sql);
}
if (!file_exists(__DIR__ . '/config.local.php')) {
	copy(__DIR__ . '/config.example.php', __DIR__ . '/config.local.php');
}
echo "Tablas de identidad preparadas. Configuración desactivada hasta cargar tu cuenta Didit.\n";
