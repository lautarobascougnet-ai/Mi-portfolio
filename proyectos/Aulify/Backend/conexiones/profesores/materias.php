<?php
declare(strict_types=1);
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// Se usa desde solicitudes y clases; el índice único evita propuestas duplicadas.
function aulifySubject(mysqli $db, string $name, int $user): array {
    $db->execute_query("INSERT IGNORE INTO aulify_materias (nombre,solicitado_por) VALUES (?,?)", [$name, $user]);
    return $db->execute_query('SELECT id,nombre,estado,motivo FROM aulify_materias WHERE nombre=?', [$name])->fetch_assoc();
}
$app->get('/subjects', function (Request $request, Response $response) use ($conexion, $json): Response {
    return $json($response, ['subjects' => $conexion->query("SELECT nombre FROM aulify_materias WHERE estado='aprobada' ORDER BY nombre")->fetch_all(MYSQLI_ASSOC)]);
});
$app->get('/admin/subjects', function (Request $request, Response $response) use ($conexion, $json, $adminId): Response {
    if (!$adminId()) return $json($response, ['error'=>'Acceso denegado.'],403);
    return $json($response, ['subjects'=>$conexion->query("SELECT m.*, CONCAT(u.nombre,' ',u.apellido) solicitante FROM aulify_materias m LEFT JOIN usuarios u ON u.id=m.solicitado_por WHERE m.solicitado_por IS NOT NULL ORDER BY (m.estado='pendiente') DESC,m.id DESC LIMIT 200")->fetch_all(MYSQLI_ASSOC)]);
});
$app->post('/admin/subject-review', function (Request $request, Response $response) use ($conexion, $json, $adminId, $adminCsrf): Response {
    $reviewer = $adminId();
    if (!$reviewer || !$adminCsrf($request)) return $json($response,['error'=>'Acceso denegado.'],403);
    $data = (array)$request->getParsedBody();
    $id = filter_var($data['id'] ?? null,FILTER_VALIDATE_INT);
    $state = $data['estado'] ?? '';
    $reason = $data['motivo'] ?? '';
    if (!$id || !in_array($state,['aprobada','rechazada'],true) || !is_string($reason) || mb_strlen($reason)>1000) return $json($response,['error'=>'Revisión inválida.'],422);
    $conexion->execute_query("UPDATE aulify_materias SET estado=?,motivo=?,revisado_por=?,revisado_en=UTC_TIMESTAMP() WHERE id=? AND estado='pendiente'",[$state,trim($reason),$reviewer,$id]);
    if (!$conexion->affected_rows) return $json($response,['error'=>'La materia ya fue revisada.'],409);
    return $json($response,['message'=>'Materia revisada. Si fue aprobada, el profesor ya puede publicar su clase.']);
});
