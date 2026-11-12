<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
require __DIR__ . '/Didit.php';
require __DIR__ . '/Registration.php';
(new \Aulify\Identidad\Registration($conexion, \Aulify\Identidad\configuration()))->cleanup();
echo "Datos de intentos vencidos purgados.\n";
