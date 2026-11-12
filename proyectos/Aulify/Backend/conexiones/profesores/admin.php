<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// Sesión administrativa separada del login normal y permiso anclado a un ID.
$adminId = static function () use ($conexion): int {
	$id = (int) ($_SESSION['admin_id'] ?? 0);
	if (!$id || (int) ($_SESSION['admin_expires'] ?? 0) < time()) return 0;
	$row = $conexion->execute_query('SELECT u.password_hash FROM aulify_administradores a JOIN usuarios u ON u.id=a.usuario_id WHERE a.usuario_id=?', [$id])->fetch_assoc();
	return $row && hash_equals($_SESSION['admin_signature'] ?? '', hash('sha256', $row['password_hash'])) ? $id : 0;
};
$adminCsrf = static fn(Request $request): bool => !empty($_SESSION['admin_csrf']) && hash_equals($_SESSION['admin_csrf'], $request->getHeaderLine('X-CSRF-Token'));

$app->get('/admin/session', function (Request $request, Response $response) use ($json, $adminId): Response {
	$_SESSION['admin_csrf'] ??= bin2hex(random_bytes(32));
	return $json($response, ['authenticated' => $adminId() > 0, 'csrf' => $_SESSION['admin_csrf']]);
});
$app->post('/admin/login', function (Request $request, Response $response) use ($conexion, $json, $adminCsrf): Response {
	if (!$adminCsrf($request)) return $json($response, ['error' => 'Recargá el acceso administrativo.'], 403);
	$data = (array) ($request->getParsedBody() ?? []);
	if (($_SESSION['admin_attempt_until'] ?? 0) < time()) { $_SESSION['admin_attempts'] = 0; $_SESSION['admin_attempt_until'] = time() + 900; }
	if (($_SESSION['admin_attempts'] ?? 0) >= 5) return $json($response, ['error' => 'Demasiados intentos. Esperá 15 minutos.'], 429);
	$_SESSION['admin_attempts']++;
	$row = $conexion->query('SELECT u.id, u.password_hash FROM aulify_administradores a JOIN usuarios u ON u.id=a.usuario_id ORDER BY u.id LIMIT 1')->fetch_assoc();
	if (($data['username'] ?? null) !== 'admin' || !is_string($data['password'] ?? null) || !$row || !password_verify($data['password'], $row['password_hash'])) return $json($response, ['error' => 'Acceso administrativo incorrecto.'], 401);
	if (session_status() === PHP_SESSION_ACTIVE) session_regenerate_id(true);
	$_SESSION['admin_id'] = (int) $row['id'];
	$_SESSION['admin_expires'] = time() + 1800;
	$_SESSION['admin_signature'] = hash('sha256', $row['password_hash']);
	$_SESSION['admin_attempts'] = 0;
	return $json($response, ['authenticated' => true]);
});
$app->post('/admin/logout', function (Request $request, Response $response) use ($json, $adminCsrf): Response {
	if (!$adminCsrf($request)) return $json($response, ['error' => 'Sesión no válida.'], 403);
	unset($_SESSION['admin_id'], $_SESSION['admin_expires'], $_SESSION['admin_signature']);
	return $json($response, ['authenticated' => false]);
});

$app->get('/admin/teachers', function (Request $request, Response $response) use ($conexion, $json, $adminId): Response {
	if (!$adminId()) return $json($response, ['error' => 'Solo el administrador puede revisar solicitudes.'], 403);
	$page = max(0, (int) ($request->getQueryParams()['page'] ?? 0));
	$offset = min($page, 1000000) * 50;
	$rows = $conexion->query("SELECT s.usuario_id, COALESCE(s.email_solicitud,u.email) email, s.materia, s.nombre_completo, s.nombre_usuario, s.experiencia, s.descripcion, s.motivacion, s.estudios, s.titulo_nombre, s.estado, s.creado_en, s.revision_motivo, s.revisado_en FROM solicitudes_profesor s JOIN usuarios u ON u.id=s.usuario_id ORDER BY (s.estado='pendiente') DESC, s.creado_en DESC, s.usuario_id DESC LIMIT 51 OFFSET $offset")->fetch_all(MYSQLI_ASSOC);
	$more = count($rows) > 50;
	$rows = array_slice($rows, 0, 50);
	foreach ($rows as &$row) $row['estudios'] = json_decode($row['estudios'], true);
	return $json($response, ['applications' => $rows, 'has_more' => $more]);
});
$app->get('/admin/teacher-title', function (Request $request, Response $response) use ($conexion, $json, $adminId): Response {
	if (!$adminId()) return $json($response, ['error' => 'Acceso denegado.'], 403);
	$row = $conexion->execute_query('SELECT imagen_titulo, titulo_mime FROM solicitudes_profesor WHERE usuario_id=?', [(int) ($request->getQueryParams()['user_id'] ?? 0)])->fetch_assoc();
	if (!$row || !$row['imagen_titulo'] || !in_array($row['titulo_mime'], ['image/png', 'image/jpeg', 'image/webp'], true)) return $json($response, ['error' => 'No hay título adjunto.'], 404);
	return $json($response, ['mime' => $row['titulo_mime'], 'data' => base64_encode($row['imagen_titulo'])]);
});
$app->post('/admin/teacher-review', function (Request $request, Response $response) use ($conexion, $json, $adminId, $adminCsrf): Response {
	$reviewer = $adminId();
	if (!$reviewer) return $json($response, ['error' => 'Acceso denegado.'], 403);
	if (!$adminCsrf($request)) return $json($response, ['error' => 'Recargá el panel antes de revisar.'], 403);
	$data = (array) ($request->getParsedBody() ?? []);
	$id = filter_var($data['user_id'] ?? null, FILTER_VALIDATE_INT);
	$state = $data['estado'] ?? '';
	$reason = is_string($data['motivo'] ?? null) ? trim($data['motivo']) : '';
	if (!$id || $id < 1 || !in_array($state, ['aprobada', 'rechazada'], true) || mb_strlen($reason) > 1000) return $json($response, ['error' => 'Decisión o motivo no válido.'], 422);
	$conexion->begin_transaction();
	try {
		// Mismo orden de bloqueo que el envío del formulario.
		$conexion->execute_query('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [$id]);
		$row = $conexion->execute_query('SELECT estado, experiencia, descripcion, email_solicitud FROM solicitudes_profesor WHERE usuario_id=? FOR UPDATE', [$id])->fetch_assoc();
		if (!$row || $row['estado'] !== 'pendiente') { $conexion->rollback(); return $json($response, ['error' => 'La solicitud no existe o ya fue revisada.'], 409); }
		$conexion->execute_query('UPDATE solicitudes_profesor SET estado=?, revision_motivo=?, revisado_por=?, revisado_en=UTC_TIMESTAMP() WHERE usuario_id=?', [$state, $reason, $reviewer, $id]);
		if ($state === 'aprobada') {
			$email = $row['email_solicitud'] ?: $conexion->execute_query('SELECT email FROM usuarios WHERE id=?',[$id])->fetch_assoc()['email'];
			$conexion->execute_query('INSERT IGNORE INTO aulify_correos (evento,destinatario,asunto,cuerpo) VALUES (?,?,?,?)', ['profesor-aprobado-'.$id,$email,'Tu solicitud de profesor fue aprobada','Tu solicitud para ser profesor en Aulify fue aprobada. Iniciá sesión y entrá en Ser profesor para continuar. '.$reason]);
			// Inicializa campos vacíos; no borra experiencia o descripción ya guardadas.
			$conexion->execute_query("UPDATE usuarios SET experiencia=IF(COALESCE(experiencia,'')='',?,experiencia), descripcion=IF(COALESCE(descripcion,'')='',?,descripcion) WHERE id=?", [$row['experiencia'], $row['descripcion'], $id]);
		}
		$conexion->commit();
	} catch (Throwable $error) { $conexion->rollback(); return $json($response, ['error' => 'No se pudo guardar la revisión.'], 500); }
	return $json($response, ['estado' => $state, 'message' => 'Revisión guardada. El solicitante verá el cambio en su pantalla. Si fue aprobado, su aviso por correo quedó en cola de envío.']);
});
