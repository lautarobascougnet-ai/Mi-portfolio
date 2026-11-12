<?php
declare(strict_types=1);
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
require_once __DIR__ . '/flujo.php';

$app->get('/bookings/detail', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId, $bookingSelect): Response {
    $user = $authenticatedUserId();
    if (!$user) return $json($response, ['error' => 'Iniciá sesión.'], 401);
    $id = (int) ($request->getQueryParams()['id'] ?? 0);
    $row = $conexion->execute_query($bookingSelect . ' WHERE r.id=? AND (r.profesor_id=? OR r.alumno_id=?)', [$id, $user, $user])->fetch_assoc();
    if (!$row) return $json($response, ['error' => 'Reserva no encontrada.'], 404);
    $_SESSION['classes_csrf'] ??= bin2hex(random_bytes(32));
    $row = aulifyBookingView($row, $user);
    $after = max(0, (int) ($request->getQueryParams()['after'] ?? 0));
    $messages = $row['chat_activo'] ? $conexion->execute_query('SELECT id,usuario_id,texto,creado_en FROM aulify_reserva_mensajes WHERE reserva_id=? AND id>? ORDER BY id LIMIT 100', [$id, $after])->fetch_all(MYSQLI_ASSOC) : [];
    return $json($response, ['booking' => $row, 'messages' => $messages, 'csrf' => $_SESSION['classes_csrf'], 'user_id' => $user]);
});

$app->post('/bookings/{action:accept|reject|pay|cancel|finish|message|read}', function (Request $request, Response $response, array $args) use ($conexion, $json, $authenticatedUserId): Response {
    $user = $authenticatedUserId();
    if (!$user) return $json($response, ['error' => 'Iniciá sesión.'], 401);
    if (empty($_SESSION['classes_csrf']) || !hash_equals($_SESSION['classes_csrf'], $request->getHeaderLine('X-CSRF-Token'))) return $json($response, ['error' => 'Recargá la reserva.'], 403);
    $data = (array) ($request->getParsedBody() ?? []);
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) return $json($response, ['error' => 'Reserva inválida.'], 422);
    $conexion->begin_transaction();
    try {
        $row = $conexion->execute_query('SELECT * FROM aulify_reservas WHERE id=? AND (profesor_id=? OR alumno_id=?) FOR UPDATE', [$id, $user, $user])->fetch_assoc();
        if (!$row) { $conexion->rollback(); return $json($response, ['error' => 'Reserva no encontrada.'], 404); }
        $view = aulifyBookingView($row, $user); $action = $args['action']; $now = aulifyBookingNow()->format('Y-m-d H:i:s');
        $result = ['message' => 'Reserva actualizada.'];
        if ($action === 'read') {
            if (!$view['chat_activo']) { $conexion->rollback(); return $json($response, ['error' => 'El chat no está disponible.'], 403); }
            $last = filter_var($data['last_id'] ?? null, FILTER_VALIDATE_INT);
            if (!$last || !$conexion->execute_query('SELECT id FROM aulify_reserva_mensajes WHERE id=? AND reserva_id=?', [$last, $id])->fetch_assoc()) { $conexion->rollback(); return $json($response, ['error' => 'Mensaje no encontrado en esta reserva.'], 422); }
            $column = $view['es_profesor'] ? 'profesor_leido' : 'alumno_leido';
            $conexion->execute_query("UPDATE aulify_reservas SET $column=GREATEST($column,?) WHERE id=?", [$last, $id]);
            $result = ['message' => 'Mensajes marcados como leídos.'];
        } elseif ($action === 'message') {
            if (!$view['chat_activo']) { $conexion->rollback(); return $json($response, ['error' => 'El chat solo está disponible durante una reserva paga que permita mensajes.'], 403); }
            $text = $data['texto'] ?? null;
            if (!is_string($text) || trim($text) === '' || mb_strlen($text) > 4000) { $conexion->rollback(); return $json($response, ['error' => 'Escribí un mensaje de hasta 4000 caracteres.'], 422); }
            $conexion->execute_query('INSERT INTO aulify_reserva_mensajes (reserva_id,usuario_id,texto,creado_en) VALUES (?,?,?,?)', [$id, $user, trim($text), $now]);
        } elseif ($action === 'pay') {
            if ($view['es_profesor']) { $conexion->rollback(); return $json($response, ['error' => 'Solo el alumno puede simular el pago.'], 403); }
            // Reintentar un pago exitoso nunca genera un segundo comprobante.
            if ($row['estado'] === 'pagada') { $conexion->commit(); return $json($response, ['message' => 'El pago simulado ya fue registrado.', 'reference' => $row['pago_referencia']]); }
            if (!in_array($view['estado_vista'], ['aceptada', 'confirmada'], true)) { $conexion->rollback(); return $json($response, ['error' => 'El profesor debe aceptar una reserva vigente antes del pago.'], 409); }
            $method = $data['metodo'] ?? '';
            if (!in_array($method, ['qr', 'transferencia', 'efectivo'], true)) { $conexion->rollback(); return $json($response, ['error' => 'Elegí QR, transferencia o efectivo.'], 422); }
            $reference = 'SIM-' . $id . '-' . strtoupper(bin2hex(random_bytes(5)));
            $conexion->execute_query("UPDATE aulify_reservas SET estado='pagada',pago_metodo=?,pago_referencia=?,pagado_en=? WHERE id=?", [$method, $reference, $now, $id]);
            $result = ['message' => 'Pago simulado realizado. No se movió dinero.', 'reference' => $reference];
        } elseif ($action === 'cancel') {
            if (!$view['puede_cancelar']) { $conexion->rollback(); return $json($response, ['error' => 'Esta reserva ya no se puede cancelar.'], 409); }
            $refund = $row['estado'] === 'pagada' ? round((float) $row['precio'] * $view['devolucion_porcentaje'] / 100, 2) : 0;
            $conexion->execute_query("UPDATE aulify_reservas SET estado='cancelada',reembolso=? WHERE id=?", [$refund, $id]);
            $result = ['message' => 'Reserva cancelada. Devolución simulada: ' . number_format($refund, 2) . ' €.', 'reembolso' => $refund];
        } elseif ($action === 'finish') {
            if ($view['es_profesor']) { $conexion->rollback(); return $json($response, ['error' => 'Solo el alumno puede marcar la clase como finalizada.'], 403); }
            if ($row['estado'] === 'terminada') { $conexion->commit(); return $json($response, ['message' => 'La clase ya está marcada como finalizada.']); }
            if (!$view['puede_finalizar']) { $conexion->rollback(); return $json($response, ['error' => 'Solo podés finalizar una reserva paga.'], 409); }
            $conexion->execute_query("UPDATE aulify_reservas SET estado='terminada' WHERE id=? AND estado='pagada'", [$id]);
            $result = ['message' => 'Clase marcada como finalizada.'];
        } else {
            if (!$view['es_profesor']) { $conexion->rollback(); return $json($response, ['error' => 'Solo el profesor puede responder la solicitud.'], 403); }
            if ($view['estado_vista'] !== 'pendiente') { $conexion->rollback(); return $json($response, ['error' => 'La solicitud ya fue respondida o venció.'], 409); }
            $conexion->execute_query('UPDATE aulify_reservas SET estado=? WHERE id=?', [$action === 'accept' ? 'aceptada' : 'rechazada', $id]);
        }
        $conexion->commit(); return $json($response, $result);
    } catch (Throwable $error) { $conexion->rollback(); throw $error; }
});
