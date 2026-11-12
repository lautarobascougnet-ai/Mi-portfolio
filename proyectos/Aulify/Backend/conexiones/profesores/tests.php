<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../../vendor/autoload.php';
require __DIR__ . '/../../base de datos/conexion.php';

// Tablas temporales de esta conexión: nunca se escriben usuarios o solicitudes reales.
foreach (['usuarios', 'solicitudes_profesor', 'aulify_materias'] as $table) {
	$schema = $conexion->query("SHOW CREATE TABLE `$table`")->fetch_assoc()['Create Table'];
	$schema = preg_replace('/,\n\s+CONSTRAINT[^\n]+/', '', $schema);
	$conexion->query(str_replace('CREATE TABLE', 'CREATE TEMPORARY TABLE', $schema));
}
$conexion->execute_query('INSERT INTO usuarios (id, nombre, apellido, email, password_hash, dni, fecha_usu) VALUES (1, ?, ?, ?, ?, 0, CURRENT_DATE), (2, ?, ?, ?, ?, 0, CURRENT_DATE)', ['Prueba', 'Uno', 'uno@example.invalid', 'no-login', 'Prueba', 'Dos', 'dos@example.invalid', 'no-login']);
$app = \Slim\Factory\AppFactory::create();
$json = static function ($response, array $data, int $status = 200) {
	$response->getBody()->write(json_encode($data));
	return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
};
$authenticatedUserId = static fn(): int => (int) ($_SESSION['usuario_id'] ?? 0);
require __DIR__ . '/routes.php';
$adminId = static fn() => 0;
$adminCsrf = static fn() => false;
require __DIR__ . '/materias.php';
$checks = 0;
function check(bool $ok, string $message): void { global $checks; if (!$ok) throw new RuntimeException($message); $checks++; }
function callTeacher(string $method, array $body = [], array $files = [], bool $csrf = true, int $length = 0) {
	global $app;
	$request = (new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method, '/teacher/application')->withParsedBody($body)->withUploadedFiles($files);
	if ($csrf) $request = $request->withHeader('X-CSRF-Token', $_SESSION['teacher_csrf'] ?? '');
	if ($length) $request = $request->withHeader('Content-Length', (string) $length);
	return $app->handle($request);
}
function uploadTeacher(string $data, string $name = 'titulo.png') {
	$stream = (new \Slim\Psr7\Factory\StreamFactory())->createStream($data);
	return (new \Slim\Psr7\Factory\UploadedFileFactory())->createUploadedFile($stream, strlen($data), UPLOAD_ERR_OK, $name, 'image/png');
}
$body = ['nombre_completo' => 'Prueba Uno', 'nombre_usuario' => 'prueba', 'experiencia' => str_repeat('Experiencia. ', 3), 'descripcion' => str_repeat('Descripción. ', 3), 'motivacion' => str_repeat('Enseñar. ', 4), 'estudios' => ['secundaria']];
$body['materia'] = 'Inglés';
$body['email_solicitud'] = 'solicitud@example.invalid';
$_SESSION = [];
check(callTeacher('GET')->getStatusCode() === 401, 'GET requiere sesión');
check(callTeacher('POST', $body)->getStatusCode() === 401, 'POST requiere sesión');
$_SESSION['usuario_id'] = 1;
$initial = json_decode((string) callTeacher('GET')->getBody(), true);
check($initial['application'] === null && strlen($initial['csrf']) === 64, 'Solicitud vacía y CSRF');
check(callTeacher('POST', $body, [], false)->getStatusCode() === 403, 'Rechaza CSRF faltante');
check(callTeacher('POST', $body, [], true, 4 * 1024 * 1024)->getStatusCode() === 413, 'Límite total');
check(callTeacher('POST', array_replace($body, ['nombre_completo' => '']))->getStatusCode() === 422, 'Valida campos');
check(callTeacher('POST', array_replace($body, ['estudios' => []]))->getStatusCode() === 422, 'Exige estudios');
check(callTeacher('POST', array_replace($body, ['estudios' => ['ninguno', 'secundaria']]))->getStatusCode() === 422, 'Estudios excluyentes');
check(callTeacher('POST', array_replace($body, ['estudios' => ['inventado']]))->getStatusCode() === 422, 'Rechaza estudios desconocidos');
check(callTeacher('POST', $body, ['titulo' => uploadTeacher('<?php echo 1; ?>')])->getStatusCode() === 422, 'Rechaza imagen falsa');
check(callTeacher('POST', $body, ['titulo' => uploadTeacher(str_repeat('x', 2 * 1024 * 1024 + 1))])->getStatusCode() === 422, 'Límite adjunto');
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t1cAAAAASUVORK5CYII=');
check(callTeacher('POST', $body + ['usuario_id' => 2], ['titulo' => uploadTeacher($png)])->getStatusCode() === 201, 'Guarda solicitud con título');
$saved = json_decode((string) callTeacher('GET')->getBody(), true)['application'];
check($saved['estado'] === 'pendiente' && $saved['titulo_nombre'] === 'titulo.png', 'Recupera solicitud');
check(!isset($saved['imagen_titulo']), 'No publica imagen');
check($conexion->query('SELECT OCTET_LENGTH(imagen_titulo) AS bytes FROM solicitudes_profesor WHERE usuario_id=1')->fetch_assoc()['bytes'] == strlen($png), 'Persiste imagen en DB');
check($conexion->query('SELECT rol FROM usuarios WHERE id=1')->fetch_assoc()['rol'] === null, 'No asigna rol');
$_SESSION['usuario_id'] = 2;
check(json_decode((string) callTeacher('GET')->getBody(), true)['application'] === null, 'No accede a solicitud ajena');
$_SESSION['usuario_id'] = 1;
$body['motivacion'] = 'Una nueva motivación suficientemente extensa para guardar.';
check(callTeacher('POST', $body)->getStatusCode() === 200, 'Actualiza existente');
check($conexion->query('SELECT COUNT(*) AS total FROM solicitudes_profesor')->fetch_assoc()['total'] == 1, 'No duplica');
$saved = json_decode((string) callTeacher('GET')->getBody(), true)['application'];
check($saved['motivacion'] === $body['motivacion'] && $saved['titulo_nombre'] === 'titulo.png', 'Actualiza texto y conserva título');
check(callTeacher('POST', $body + ['eliminar_titulo' => '1'])->getStatusCode() === 200, 'Quita título propio');
check($conexion->query('SELECT imagen_titulo FROM solicitudes_profesor WHERE usuario_id=1')->fetch_assoc()['imagen_titulo'] === null, 'Título removido de DB temporal');
$conexion->query("UPDATE solicitudes_profesor SET estado='aprobada' WHERE usuario_id=1");
check(callTeacher('POST', $body)->getStatusCode() === 409, 'No edita solicitud procesada');
echo "$checks comprobaciones correctas. Solo tablas temporales; ningún dato real modificado.\n";
