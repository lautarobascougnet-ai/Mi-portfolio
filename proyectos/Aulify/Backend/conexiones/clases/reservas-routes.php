<?php
declare(strict_types=1);
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
require_once __DIR__ . '/reservas.php';

$app->get('/teachers/profile', function (Request $request, Response $response) use ($conexion, $json, $classSelect): Response {
    $id = filter_var($request->getQueryParams()['id'] ?? null, FILTER_VALIDATE_INT);
    $teacher = $id ? $conexion->execute_query("SELECT u.id,u.nombre,u.apellido,u.rating,u.foto_perfil,u.experiencia,u.titulos,u.descripcion FROM usuarios u JOIN solicitudes_profesor s ON s.usuario_id=u.id AND s.estado='aprobada' WHERE u.id=?", [$id])->fetch_assoc() : null;
    if (!$teacher) return $json($response, ['error' => 'Profesor no encontrado.'], 404);
    return $json($response, ['teacher' => $teacher, 'classes' => $conexion->execute_query($classSelect . ' WHERE c.profesor_id=? ORDER BY c.id DESC', [$id])->fetch_all(MYSQLI_ASSOC)]);
});
$app->get('/classes/detail', function (Request $request, Response $response) use ($conexion, $json, $classSelect): Response {
    $id = filter_var($request->getQueryParams()['id'] ?? null, FILTER_VALIDATE_INT);
    $class = $id ? $conexion->execute_query($classSelect . ' WHERE c.id=?', [$id])->fetch_assoc() : null;
    return $class ? $json($response, ['class' => $class]) : $json($response, ['error' => 'Clase no encontrada.'], 404);
});
$app->get('/classes/availability', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId, $classSelect): Response {
    $user = $authenticatedUserId();
    if (!$user) return $json($response, ['error' => 'Iniciá sesión para reservar.'], 401);
    $params = $request->getQueryParams();
    $id = filter_var($params['id'] ?? null, FILTER_VALIDATE_INT);
    $date = $params['date'] ?? '';
    if (!is_string($date) || !aulifyBookingDate($date)) return $json($response, ['error' => 'Elegí una fecha desde hoy hasta un año adelante.'], 422);
    $class = $id ? $conexion->execute_query($classSelect . ' WHERE c.id=?', [$id])->fetch_assoc() : null;
    if (!$class) return $json($response, ['error' => 'Clase no encontrada.'], 404);
    $_SESSION['classes_csrf'] ??= bin2hex(random_bytes(32));
    $slots = aulifyClassSlots($class['horarios'], $date);
    foreach ($slots as &$slot) $slot['available'] = (int) $class['profesor_id'] !== $user && !aulifyBookingConflict($conexion, (int) $class['profesor_id'], $user, $slot['inicio'], $slot['fin']);
    unset($slot);
    return $json($response, ['slots' => $slots, 'csrf' => $_SESSION['classes_csrf'], 'own_class' => (int) $class['profesor_id'] === $user]);
});
$app->post('/bookings', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
    $user = $authenticatedUserId();
    if (!$user) return $json($response, ['error' => 'Iniciá sesión.'], 401);
    if (empty($_SESSION['classes_csrf']) || !hash_equals($_SESSION['classes_csrf'], $request->getHeaderLine('X-CSRF-Token'))) return $json($response, ['error' => 'Recargá la página para reservar.'], 403);
    $data = (array) ($request->getParsedBody() ?? []);
    $id = filter_var($data['class_id'] ?? null, FILTER_VALIDATE_INT);
    $start = $data['inicio'] ?? null;
    if (!$id || !is_string($start) || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/D', $start)) return $json($response, ['error' => 'Elegí una clase y un horario.'], 422);
    $class = $conexion->execute_query('SELECT profesor_id FROM aulify_clases WHERE id=?', [$id])->fetch_assoc();
    if (!$class) return $json($response, ['error' => 'Clase no encontrada.'], 404);
    $teacher = (int) $class['profesor_id'];
    if ($teacher === $user) return $json($response, ['error' => 'No podés reservar tu propia clase.'], 422);
    $conexion->begin_transaction();
    try {
        // Orden fijo para evitar bloqueos cruzados entre reservas simultáneas.
        $ids = [$teacher, $user]; sort($ids);
        foreach ($ids as $lockId) $conexion->execute_query('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [$lockId])->fetch_assoc();
        $class = $conexion->execute_query("SELECT c.* FROM aulify_clases c JOIN solicitudes_profesor s ON s.usuario_id=c.profesor_id AND s.estado='aprobada' WHERE c.id=? FOR UPDATE", [$id])->fetch_assoc();
        $slot = null;
        if ($class) foreach (aulifyClassSlots($class['horarios'], substr($start, 0, 10)) as $candidate) if ($candidate['inicio'] === $start) $slot = $candidate;
        if (!$slot) { $conexion->rollback(); return $json($response, ['error' => 'Ese horario no está disponible en esta clase.'], 422); }
        if (aulifyBookingConflict($conexion, $teacher, $user, $slot['inicio'], $slot['fin'])) { $conexion->rollback(); return $json($response, ['error' => 'El horario ya fue tomado o coincide con otra de tus clases. Elegí otro.'], 409); }
        $mode = $data['modalidad'] ?? ($class['modalidad'] === 'ambas' ? '' : $class['modalidad']);
        if (!in_array($mode, ['virtual','presencial'], true) || ($class['modalidad'] !== 'ambas' && $mode !== $class['modalidad'])) { $conexion->rollback(); return $json($response, ['error' => 'Elegí una modalidad ofrecida por el profesor.'], 422); }
        $conexion->execute_query("INSERT INTO aulify_reservas (clase_id,profesor_id,alumno_id,inicio,fin,precio,moneda,estado,modalidad,permite_chat) VALUES (?,?,?,?,?,?,?,'pendiente',?,?)", [$id, $teacher, $user, $slot['inicio'], $slot['fin'], $class['precio'], $class['moneda'], $mode, $class['permite_chat']]);
        $reservation = $conexion->insert_id; $conexion->commit();
        return $json($response, ['id' => $reservation, 'message' => 'Solicitud enviada. El profesor debe aceptarla antes de que puedas pagar.'], 201);
    } catch (Throwable $error) { $conexion->rollback(); throw $error; }
});

require __DIR__ . '/flujo-routes.php';
