<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../base de datos/conexion.php';
$columns = [
    'aulify_clases' => ['permite_chat' => 'TINYINT NOT NULL DEFAULT 0'],
    'aulify_reservas' => ['modalidad' => "VARCHAR(20) NOT NULL DEFAULT 'virtual'", 'permite_chat' => 'TINYINT NOT NULL DEFAULT 0', 'pago_metodo' => 'VARCHAR(20) NULL', 'pago_referencia' => 'VARCHAR(60) NULL', 'pagado_en' => 'DATETIME NULL', 'reembolso' => 'DECIMAL(10,2) NULL'],
];
foreach ($columns as $table => $fields) foreach ($fields as $name => $definition) {
    if (!$conexion->query("SHOW COLUMNS FROM $table LIKE '$name'")->num_rows) $conexion->query("ALTER TABLE $table ADD $name $definition");
}
foreach (['alumno_leido', 'profesor_leido'] as $column) {
    if (!$conexion->query("SHOW COLUMNS FROM aulify_reservas LIKE '$column'")->num_rows) $conexion->query("ALTER TABLE aulify_reservas ADD $column BIGINT NOT NULL DEFAULT 0");
}
$conexion->query(file_get_contents(__DIR__ . '/flujo-schema.sql'));
// Conserva la modalidad de las reservas creadas antes del flujo de solicitudes.
$conexion->query("UPDATE aulify_reservas r JOIN aulify_clases c ON c.id=r.clase_id SET r.modalidad=c.modalidad WHERE r.estado='confirmada' AND c.modalidad IN ('presencial','virtual')");
echo "Flujo de reservas, pagos simulados y chat disponible.\n";
