<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// Todas las consultas se restringen al dueño de la sesión, incluidos los IDs relacionados.
$app->get('/notes', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
    $uid = $authenticatedUserId();
    if (!$uid) return $json($response, ['error' => 'Iniciá sesión para ver tus apuntes.'], 401);
    $_SESSION['notes_csrf'] ??= bin2hex(random_bytes(32));
    $params = $request->getQueryParams();
    if (isset($params['id'])) {
        $note = $conexion->execute_query('SELECT * FROM aulify_apuntes WHERE id=? AND usuario_id=?', [(int) $params['id'], $uid])->fetch_assoc();
        return $note ? $json($response, ['note' => $note]) : $json($response, ['error' => 'Apunte no encontrado.'], 404);
    }
    $page = max(1, (int) ($params['page'] ?? 1));
    if (isset($params['folder'])) {
        $folderId = max(0, (int) $params['folder']);
        $folder = $folderId ? $conexion->execute_query('SELECT id,nombre,descripcion FROM aulify_carpetas WHERE id=? AND usuario_id=?', [$folderId, $uid])->fetch_assoc() : null;
        if ($folderId && !$folder) return $json($response, ['error' => 'Carpeta no encontrada.'], 404);
        $condition = 'usuario_id=? AND ' . ($folderId ? 'carpeta_id=?' : 'carpeta_id IS NULL');
        $values = $folderId ? [$uid, $folderId] : [$uid];
        $total = (int) $conexion->execute_query("SELECT COUNT(*) total FROM aulify_apuntes WHERE $condition", $values)->fetch_assoc()['total'];
        $size = 12;
        $page = min($page, max(1, (int) ceil($total / $size)));
        $offset = ($page - 1) * $size;
        $items = $conexion->execute_query("SELECT id,nombre,descripcion,actualizado FROM aulify_apuntes WHERE $condition ORDER BY id DESC LIMIT $size OFFSET $offset", $values)->fetch_all(MYSQLI_ASSOC);
        return $json($response, ['items' => $items, 'folder' => $folder, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $size)), 'csrf' => $_SESSION['notes_csrf']]);
    }
    $total = (int) $conexion->execute_query('SELECT COUNT(*) total FROM aulify_carpetas WHERE usuario_id=?', [$uid])->fetch_assoc()['total'];
    $pages = max(1, (int) ceil($total / 4));
    $page = min($page, $pages);
    $offset = ($page - 1) * 4;
    $items = $conexion->execute_query("SELECT c.id,c.nombre,c.descripcion,(SELECT COUNT(*) FROM aulify_apuntes n WHERE n.carpeta_id=c.id AND n.usuario_id=c.usuario_id) cantidad FROM aulify_carpetas c WHERE c.usuario_id=? ORDER BY c.id DESC LIMIT 4 OFFSET $offset", [$uid])->fetch_all(MYSQLI_ASSOC);
    return $json($response, ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages, 'csrf' => $_SESSION['notes_csrf']]);
});

$app->post('/notes/{action:folder-save|folder-delete|save|delete}', function (Request $request, Response $response, array $args) use ($conexion, $json, $authenticatedUserId): Response {
    $uid = $authenticatedUserId();
    if (!$uid) return $json($response, ['error' => 'Iniciá sesión para guardar tus apuntes.'], 401);
    if (empty($_SESSION['notes_csrf']) || !hash_equals($_SESSION['notes_csrf'], $request->getHeaderLine('X-CSRF-Token'))) return $json($response, ['error' => 'La sesión cambió. Recargá la página antes de continuar.'], 403);
    $data = (array) ($request->getParsedBody() ?? []);
    $action = $args['action'];
    $isFolder = str_starts_with($action, 'folder-');
    $table = $isFolder ? 'aulify_carpetas' : 'aulify_apuntes';
    $id = filter_var($data['id'] ?? 0, FILTER_VALIDATE_INT);
    if ($id === false || $id < 0) return $json($response, ['error' => 'Identificador inválido.'], 422);
    if (str_ends_with($action, 'delete')) {
        $conexion->execute_query("DELETE FROM $table WHERE id=? AND usuario_id=?", [$id, $uid]);
        return $conexion->affected_rows ? $json($response, ['message' => 'Eliminado.']) : $json($response, ['error' => 'No se encontró el elemento.'], 404);
    }
    foreach ($isFolder ? ['nombre', 'descripcion'] : ['nombre', 'descripcion', 'contenido'] as $field) {
        if (!is_string($data[$field] ?? null)) return $json($response, ['error' => 'Revisá los campos del formulario.'], 422);
    }
    $name = trim($data['nombre']);
    if ($name === '' || strlen($name) > 65535) return $json($response, ['error' => 'Escribí un nombre válido.'], 422);
    $conexion->begin_transaction();
    try {
        if ($id && !$conexion->execute_query("SELECT id FROM $table WHERE id=? AND usuario_id=? FOR UPDATE", [$id, $uid])->fetch_assoc()) {
            $conexion->rollback();
            return $json($response, ['error' => 'No se encontró el elemento.'], 404);
        }
        if ($isFolder) {
            if ($id) $conexion->execute_query('UPDATE aulify_carpetas SET nombre=?,descripcion=? WHERE id=? AND usuario_id=?', [$name, $data['descripcion'], $id, $uid]);
            else { $conexion->execute_query('INSERT INTO aulify_carpetas (usuario_id,nombre,descripcion) VALUES (?,?,?)', [$uid, $name, $data['descripcion']]); $id = $conexion->insert_id; }
        } else {
            $folder = filter_var($data['carpeta_id'] ?? 0, FILTER_VALIDATE_INT);
            if ($folder === false || $folder < 0 || ($folder && !$conexion->execute_query('SELECT id FROM aulify_carpetas WHERE id=? AND usuario_id=? FOR UPDATE', [$folder, $uid])->fetch_assoc())) {
                $conexion->rollback();
                return $json($response, ['error' => 'Carpeta no encontrada.'], 404);
            }
            if ($id) {
                $conexion->execute_query('UPDATE aulify_apuntes SET nombre=?,descripcion=?,contenido=?,carpeta_id=?,version=version+1 WHERE id=? AND usuario_id=? AND version=?', [$name, $data['descripcion'], $data['contenido'], $folder ?: null, $id, $uid, (int) ($data['version'] ?? 0)]);
                if (!$conexion->affected_rows) {
                    $conexion->rollback();
                    return $json($response, ['error' => 'Este apunte cambió en otra ventana. Copiá tus cambios antes de volver a abrirlo.'], 409);
                }
            } else {
                $conexion->execute_query('INSERT INTO aulify_apuntes (usuario_id,carpeta_id,nombre,descripcion,contenido) VALUES (?,?,?,?,?)', [$uid, $folder ?: null, $name, $data['descripcion'], $data['contenido']]);
                $id = $conexion->insert_id;
            }
        }
        $version = $isFolder ? null : (int) $conexion->execute_query('SELECT version FROM aulify_apuntes WHERE id=? AND usuario_id=?', [$id, $uid])->fetch_assoc()['version'];
        $conexion->commit();
        return $json($response, ['id' => $id, 'version' => $version, 'message' => 'Guardado.']);
    } catch (Throwable $error) { $conexion->rollback(); throw $error; }
});
