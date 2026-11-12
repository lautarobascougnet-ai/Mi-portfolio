<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
require_once __DIR__ . '/horarios.php';
require_once __DIR__ . '/flujo.php';

// La aprobación se comprueba en la base de datos, nunca desde datos del navegador.
$isClassTeacher = static function (int $id) use ($conexion): bool {
    return (bool) $conexion->execute_query("SELECT usuario_id FROM solicitudes_profesor WHERE usuario_id=? AND estado='aprobada'", [$id])->fetch_assoc();
};

$app->post('/subjects/request', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId, $isClassTeacher): Response {
    $id = $authenticatedUserId();
    if (!$id) return $json($response, ['error' => 'Iniciá sesión para proponer una materia.'], 401);
    if (!$isClassTeacher($id)) return $json($response, ['error' => 'Solo los profesores aprobados pueden proponer materias.'], 403);
    if (empty($_SESSION['classes_csrf']) || !hash_equals($_SESSION['classes_csrf'], $request->getHeaderLine('X-CSRF-Token'))) {
        return $json($response, ['error' => 'Recargá la página antes de proponer la materia.'], 403);
    }

    $data = (array) ($request->getParsedBody() ?? []);
    $name = $data['nombre'] ?? null;
    if (!is_string($name)) return $json($response, ['error' => 'Escribí un nombre de materia válido.'], 422);
    $name = preg_replace('/\s+/u', ' ', trim($name));
    if (!is_string($name) || $name === '' || mb_strlen($name) > 100) {
        return $json($response, ['error' => 'El nombre debe tener entre 1 y 100 caracteres.'], 422);
    }

    $subject = aulifySubject($conexion, $name, $id);
    if ($subject['estado'] === 'rechazada') {
        return $json($response, ['error' => 'Esa materia fue rechazada anteriormente. Consultá al administrador.'], 409);
    }
    $message = $subject['estado'] === 'aprobada'
        ? 'Esa materia ya está aprobada y quedó seleccionada para tu clase.'
        : 'Propuesta enviada. El administrador la revisará desde el panel de profesores; podrás publicar la clase cuando la apruebe.';
    return $json($response, ['message' => $message, 'subject' => $subject]);
});

$classSelect = "SELECT c.id, c.profesor_id, c.materia, c.descripcion, c.precio, c.moneda, c.modalidad, c.horarios, c.permite_chat, CONCAT(u.nombre, ' ', u.apellido) AS profesor, u.rating, u.foto_perfil FROM aulify_clases c JOIN usuarios u ON u.id=c.profesor_id JOIN solicitudes_profesor s ON s.usuario_id=c.profesor_id AND s.estado='aprobada'";

// Catálogo público: no expone correos, documentos ni datos de solicitudes.
$app->get('/classes', function (Request $request, Response $response) use ($conexion, $json, $classSelect): Response {
    return $json($response, ['classes' => $conexion->query($classSelect . ' ORDER BY c.id DESC')->fetch_all(MYSQLI_ASSOC), 'subjects' => $conexion->query("SELECT nombre FROM aulify_materias WHERE estado='aprobada' ORDER BY nombre")->fetch_all(MYSQLI_ASSOC)]);
});

$app->get('/classes/mine', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId, $isClassTeacher, $classSelect, $bookingSelect): Response {
    $id = $authenticatedUserId();
    if (!$id) return $json($response, ['error' => 'Iniciá sesión para ver tus clases.'], 401);
    $_SESSION['classes_csrf'] ??= bin2hex(random_bytes(32));
    $teacher = $isClassTeacher($id);
    $unread = [];
    $counts = $conexion->execute_query('SELECT r.id,COUNT(m.id) cantidad FROM aulify_reservas r JOIN aulify_reserva_mensajes m ON m.reserva_id=r.id AND m.usuario_id<>? AND m.id>CASE WHEN r.profesor_id=? THEN r.profesor_leido ELSE r.alumno_leido END WHERE r.profesor_id=? OR r.alumno_id=? GROUP BY r.id', [$id, $id, $id, $id]);
    foreach ($counts->fetch_all(MYSQLI_ASSOC) as $count) $unread[(int) $count['id']] = (int) $count['cantidad'];
    return $json($response, [
        'is_professor' => $teacher,
        'csrf' => $_SESSION['classes_csrf'],
        'user_id' => $id,
        'scheduled' => array_map(function ($row) use ($id, $unread) {
            $view = aulifyBookingView($row, $id);
            $view['mensajes_sin_leer'] = $view['chat_activo'] ? ($unread[(int) $row['id']] ?? 0) : 0;
            return $view;
        }, $conexion->execute_query($bookingSelect . ' WHERE r.profesor_id=? OR r.alumno_id=? ORDER BY r.inicio DESC,r.id DESC', [$id, $id])->fetch_all(MYSQLI_ASSOC)),
        'classes' => $teacher ? $conexion->execute_query($classSelect . ' WHERE c.profesor_id=? ORDER BY c.id DESC', [$id])->fetch_all(MYSQLI_ASSOC) : [],
    ]);
});

$saveClass = function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId, $isClassTeacher): Response {
    $id = $authenticatedUserId();
    if (!$id) return $json($response, ['error' => 'Iniciá sesión.'], 401);
    if (!$isClassTeacher($id)) return $json($response, ['error' => 'Solo los profesores aprobados pueden crear clases.'], 403);
    if (empty($_SESSION['classes_csrf']) || !hash_equals($_SESSION['classes_csrf'], $request->getHeaderLine('X-CSRF-Token'))) return $json($response, ['error' => 'Recargá la página antes de crear la clase.'], 403);
    $data = (array) ($request->getParsedBody() ?? []);
    foreach (['materia', 'descripcion', 'modalidad'] as $field) {
        if (!is_string($data[$field] ?? null)) return $json($response, ['error' => 'Completá todos los campos.'], 422);
    }
    $materia = preg_replace('/\s+/u', ' ', trim($data['materia']));
    $descripcion = trim($data['descripcion']);
    $precio = $data['precio'] ?? null;
    $moneda = $data['moneda'] ?? 'EUR';
    $chat = filter_var($data['permite_chat'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    if (!$materia || mb_strlen($materia) > 100 || mb_strlen($descripcion) < 10 || mb_strlen($descripcion) > 2000 || !is_scalar($precio) || !is_numeric($precio) || !is_finite((float) $precio) || (float) $precio < 0 || (float) $precio > 100000 || !in_array($moneda, ['ARS', 'USD', 'EUR'], true) || !in_array($data['modalidad'], ['virtual', 'presencial', 'ambas'], true)) {
        return $json($response, ['error' => 'Revisá materia (1–100 caracteres), descripción (10–2000), precio (0–100000) y modalidad.'], 422);
    }
    try {
        $horarios = aulifyValidateSchedule($data['horarios'] ?? null);
    } catch (InvalidArgumentException $error) {
        return $json($response, ['error' => $error->getMessage()], 422);
    }
    // Una propuesta no publica la clase ni modifica una clase ya existente.
    if (str_ends_with($request->getUri()->getPath(), '/classes/update')) {
        $editId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$editId || !$conexion->execute_query('SELECT id FROM aulify_clases WHERE id=? AND profesor_id=?',[$editId,$id])->fetch_assoc()) return $json($response,['error'=>'Solo podés editar tus propias clases.'],403);
    }
    $subject = aulifySubject($conexion, $materia, $id);
    if ($subject['estado'] !== 'aprobada') return $json($response, ['error' => $subject['estado'] === 'pendiente' ? 'Materia enviada a revisión en el panel de profesores. Tu clase todavía no se publicó. Conservá el formulario y volvé a enviarlo cuando sea aprobada.' : 'Esta materia fue rechazada: '.($subject['motivo'] ?: 'Consultá al administrador.')], 409);
    $materia = $subject['nombre'];
    if (str_ends_with($request->getUri()->getPath(), '/classes/update')) {
        $classId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$classId) return $json($response, ['error' => 'Clase inválida.'], 422);
        $conexion->begin_transaction();
        try {
            $conexion->execute_query('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [$id])->fetch_assoc();
            $own = $conexion->execute_query('SELECT id FROM aulify_clases WHERE id=? AND profesor_id=? FOR UPDATE', [$classId, $id])->fetch_assoc();
            if (!$own) { $conexion->rollback(); return $json($response, ['error' => 'Solo podés editar tus propias clases.'], 403); }
            $conexion->execute_query('UPDATE aulify_clases SET materia=?,descripcion=?,precio=?,moneda=?,modalidad=?,horarios=?,permite_chat=? WHERE id=? AND profesor_id=?', [$materia, $descripcion, round((float) $precio, 2), $moneda, $data['modalidad'], json_encode($horarios, JSON_UNESCAPED_UNICODE), $chat, $classId, $id]);
            $conexion->commit();
            return $json($response, ['message' => 'Clase actualizada. Las reservas ya confirmadas se conservan.']);
        } catch (Throwable $error) { $conexion->rollback(); throw $error; }
    }
    $conexion->execute_query('INSERT INTO aulify_clases (profesor_id, materia, descripcion, precio, moneda, modalidad, horarios, permite_chat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$id, $materia, $descripcion, round((float) $precio, 2), $moneda, $data['modalidad'], json_encode($horarios, JSON_UNESCAPED_UNICODE), $chat]);
    return $json($response, ['id' => $conexion->insert_id, 'message' => 'Clase publicada. Ya aparece en el catálogo y en los filtros.'], 201);
};
$app->post('/classes', $saveClass);
$app->post('/classes/update', $saveClass);
