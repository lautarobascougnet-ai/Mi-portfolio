<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// Cada usuario solo puede consultar o actualizar su propia solicitud.
$app->get('/teacher/application', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
	$id = $authenticatedUserId();
	if (!$id) return $json($response, ['error' => 'Debes iniciar sesión.'], 401);
	$user = $conexion->execute_query('SELECT id FROM usuarios WHERE id = ?', [$id])->fetch_assoc();
	if (!$user) return $json($response, ['error' => 'Usuario no encontrado.'], 401);
	$_SESSION['teacher_csrf'] ??= bin2hex(random_bytes(32));
	$row = $conexion->execute_query('SELECT materia, email_solicitud, nombre_completo, nombre_usuario, experiencia, descripcion, motivacion, estudios, titulo_nombre, estado, revision_motivo, revisado_en FROM solicitudes_profesor WHERE usuario_id = ?', [$id])->fetch_assoc();
	if ($row) $row['estudios'] = json_decode($row['estudios'], true);
	return $json($response, ['application' => $row, 'csrf' => $_SESSION['teacher_csrf']]);
});

$app->post('/teacher/application', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
	$id = $authenticatedUserId();
	if (!$id) return $json($response, ['error' => 'Debes iniciar sesión.'], 401);
	$csrf = $_SESSION['teacher_csrf'] ?? '';
	if ($csrf === '' || !hash_equals($csrf, $request->getHeaderLine('X-CSRF-Token'))) return $json($response, ['error' => 'Recargá el formulario antes de enviarlo.'], 403);
	if ((int) $request->getHeaderLine('Content-Length') > 3 * 1024 * 1024) return $json($response, ['error' => 'El formulario supera el límite de tamaño.'], 413);
	$data = (array) ($request->getParsedBody() ?? []);
	$fields = [];
	foreach (['materia' => [1, 100], 'nombre_completo' => [3, 150], 'nombre_usuario' => [3, 50], 'experiencia' => [20, 4000], 'descripcion' => [20, 2000], 'motivacion' => [20, 2000]] as $key => [$min, $max]) {
		$value = is_string($data[$key] ?? null) ? trim($data[$key]) : '';
		if (mb_strlen($value) < $min || mb_strlen($value) > $max) return $json($response, ['error' => "Revisá $key: debe tener entre $min y $max caracteres."], 422);
		$fields[$key] = $value;
	}
	$email = is_string($data['email_solicitud'] ?? null) ? trim($data['email_solicitud']) : '';
	if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email)>254) return $json($response, ['error'=>'Ingresá un correo válido para recibir la revisión.'],422);
	$fields['materia'] = preg_replace('/\s+/u', ' ', $fields['materia']);
	$studies = $data['estudios'] ?? [];
	if (!is_array($studies) || !$studies || count($studies) > 2) return $json($response, ['error' => 'Seleccioná tus estudios completados.'], 422);
	foreach ($studies as $study) {
		if (!is_string($study) || !in_array($study, ['secundaria', 'universidad', 'ninguno'], true)) return $json($response, ['error' => 'Estudios no válidos.'], 422);
	}
	$studies = array_values(array_unique($studies));
	if (in_array('ninguno', $studies, true) && count($studies) !== 1) return $json($response, ['error' => 'Ningún estudio completo no puede combinarse con otros estudios.'], 422);

	// Imágenes privadas en la base: no se crean archivos ejecutables ni URLs públicas.
	$image = $mime = $filename = null;
	$upload = $request->getUploadedFiles()['titulo'] ?? null;
	if ($upload && !($upload instanceof \Psr\Http\Message\UploadedFileInterface)) return $json($response, ['error' => 'Adjuntá una sola imagen.'], 422);
	if ($upload && $upload->getError() !== UPLOAD_ERR_NO_FILE) {
		if ($upload->getError() !== UPLOAD_ERR_OK || $upload->getSize() > 2 * 1024 * 1024) return $json($response, ['error' => 'La imagen debe pesar hasta 2 MB.'], 422);
		$image = (string) $upload->getStream();
		$info = @getimagesizefromstring($image);
		$mime = $info['mime'] ?? '';
		if (!$info || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || $info[0] > 8000 || $info[1] > 8000) return $json($response, ['error' => 'Adjuntá una imagen JPG, PNG o WEBP válida, de hasta 8000 píxeles por lado.'], 422);
		$filename = mb_substr(basename(str_replace('\\', '/', $upload->getClientFilename() ?? 'titulo')), 0, 120);
	}
	$remove = ($data['eliminar_titulo'] ?? '') === '1';
	$conexion->begin_transaction();
	try {
		// Bloqueo por usuario: evita duplicar una solicitud con dos envíos simultáneos.
		$user = $conexion->execute_query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [$id])->fetch_assoc();
		if (!$user) { $conexion->rollback(); return $json($response, ['error' => 'Usuario no encontrado.'], 401); }
		$previous = $conexion->execute_query('SELECT estado, imagen_titulo, titulo_mime, titulo_nombre FROM solicitudes_profesor WHERE usuario_id = ?', [$id])->fetch_assoc();
		if ($previous && $previous['estado'] !== 'pendiente') { $conexion->rollback(); return $json($response, ['error' => 'Esta solicitud ya fue procesada y no puede editarse.'], 409); }
		if ($image === null && !$remove && $previous) {
			$image = $previous['imagen_titulo']; $mime = $previous['titulo_mime']; $filename = $previous['titulo_nombre'];
		}
		$params = [$fields['nombre_completo'], $fields['nombre_usuario'], $fields['experiencia'], $fields['descripcion'], $fields['motivacion'], json_encode($studies), $image, $mime, $filename, $id];
		if ($previous) {
			$conexion->execute_query('UPDATE solicitudes_profesor SET nombre_completo=?, nombre_usuario=?, experiencia=?, descripcion=?, motivacion=?, estudios=?, imagen_titulo=?, titulo_mime=?, titulo_nombre=? WHERE usuario_id=?', $params);
		} else {
			$conexion->execute_query('INSERT INTO solicitudes_profesor (nombre_completo, nombre_usuario, experiencia, descripcion, motivacion, estudios, imagen_titulo, titulo_mime, titulo_nombre, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', $params);
		}
		$conexion->execute_query('UPDATE solicitudes_profesor SET materia=?, email_solicitud=? WHERE usuario_id=?', [$fields['materia'], $email, $id]);
		aulifySubject($conexion, $fields['materia'], $id);
		$conexion->commit();
	} catch (Throwable $error) {
		$conexion->rollback();
		return $json($response, ['error' => 'No se pudo guardar la solicitud. Intentá nuevamente.'], 500);
	}
	return $json($response, ['message' => 'Solicitud guardada. Está pendiente de revisión.', 'estado' => 'pendiente', 'titulo_nombre' => $filename], $previous ? 200 : 201);
});
