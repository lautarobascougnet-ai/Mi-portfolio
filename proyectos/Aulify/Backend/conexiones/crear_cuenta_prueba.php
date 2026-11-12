<?php
declare(strict_types=1);

// Aprovisionamiento manual para desarrollo. No se puede ejecutar desde una URL.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../base de datos/conexion.php';

// No sobrescribe cuentas ni restablece contraseñas existentes.
$username = $argv[1] ?? 'admin';
if (!in_array($username, ['admin', 'alumno'], true)) { fwrite(STDERR, "Cuenta de prueba no admitida.\n"); exit(1); }
$email = $username . '@aulify.invalid';
$existing = $conexion->execute_query(
	'SELECT id FROM usuarios WHERE username = ? OR email = ? LIMIT 1',
	[$username, $email]
)->fetch_assoc();
if ($existing) {
	fwrite(STDERR, "Ya existe el usuario o email reservado. No se modificó ninguna cuenta.\n");
	exit(1);
}

// Recibe la contraseña por entrada estándar; no queda escrita en el código.
$password = rtrim((string) fgets(STDIN), "\r\n");
if (strlen($password) < 6 || strlen($password) > 72) {
	fwrite(STDERR, "Se necesita una contraseña de prueba entre 6 y 72 bytes por stdin.\n");
	exit(1);
}
$hash = password_hash($password, PASSWORD_DEFAULT);
unset($password);
$conexion->execute_query(
	'INSERT INTO usuarios (nombre, apellido, email, username, password_hash, dni, fecha_usu) VALUES (?, ?, ?, ?, ?, ?, ?)',
	[ucfirst($username), 'Prueba', $email, $username, $hash, 0, gmdate('Y-m-d')]
);
echo "Cuenta de prueba $username creada. Sin privilegios especiales ni identidad verificada.\n";
