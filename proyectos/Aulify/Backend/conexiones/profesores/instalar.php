<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../base de datos/conexion.php';
// Migración aditiva: conserva todas las tablas y cuentas existentes.
$conexion->query(file_get_contents(__DIR__ . '/schema.sql'));
$conexion->query(file_get_contents(__DIR__ . '/admin_schema.sql'));
// Migración idempotente: agrega auditoría sin reemplazar solicitudes previas.
foreach (['revision_motivo' => 'TEXT NULL', 'revisado_por' => 'BIGINT NULL', 'revisado_en' => 'DATETIME NULL'] as $column => $definition) {
	if (!$conexion->query("SHOW COLUMNS FROM solicitudes_profesor LIKE '$column'")->num_rows) $conexion->query("ALTER TABLE solicitudes_profesor ADD `$column` $definition");
}
// Se vincula el permiso al ID de la cuenta local, nunca a un nombre editable.
// Una vez asignado, no se agregan otros administradores al repetir la instalación.
if ((int) $conexion->query('SELECT COUNT(*) AS total FROM aulify_administradores')->fetch_assoc()['total'] === 0) {
	$admin = $conexion->execute_query('SELECT id, password_hash FROM usuarios WHERE email=?', ['admin@aulify.invalid'])->fetch_assoc();
	$password = rtrim((string) fgets(STDIN), "\r\n");
	if (!$admin || !password_verify($password, $admin['password_hash'])) throw new RuntimeException('Se necesita la contraseña de la cuenta admin local por stdin. No se asignaron permisos.');
	unset($password);
	$conexion->execute_query('INSERT INTO aulify_administradores (usuario_id) VALUES (?)', [$admin['id']]);
}
echo "Tabla de solicitudes de profesor preparada.\n";
