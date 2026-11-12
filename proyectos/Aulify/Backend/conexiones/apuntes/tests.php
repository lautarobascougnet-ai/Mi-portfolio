<?php
// Tablas temporales: no modifica carpetas, apuntes ni usuarios reales.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../../vendor/autoload.php';
require __DIR__ . '/../../base de datos/conexion.php';
foreach (explode(';', file_get_contents(__DIR__ . '/schema.sql')) as $sql) {
    $sql = preg_replace('/,\s*FOREIGN KEY[^\n,]+/', '', $sql);
    $sql = str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', $sql);
    if (trim($sql)) $conexion->query($sql);
}
$app = \Slim\Factory\AppFactory::create();
$json = static function ($response, $data, $status = 200) { $response->getBody()->write(json_encode($data)); return $response->withStatus($status); };
$authenticatedUserId = static fn() => (int) ($_SESSION['usuario_id'] ?? 0);
require __DIR__ . '/routes.php';
function callNotes($method, $path, $body = [], $csrf = true) {
    global $app;
    $parts = parse_url($path); parse_str($parts['query'] ?? '', $query);
    $request = (new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method, $parts['path'])->withQueryParams($query)->withParsedBody($body);
    if ($csrf) $request = $request->withHeader('X-CSRF-Token', $_SESSION['notes_csrf'] ?? '');
    $response = $app->handle($request);
    return [$response->getStatusCode(), json_decode((string) $response->getBody(), true)];
}
$checks = 0;
function checkNotes($condition, $message) { global $checks; if (!$condition) throw new RuntimeException($message); $checks++; }
$_SESSION = [];
checkNotes(callNotes('GET', '/notes')[0] === 401, 'Sin sesión no lista carpetas');
checkNotes(callNotes('GET', '/notes?id=1')[0] === 401, 'Sin sesión no lee texto');
checkNotes(callNotes('POST', '/notes/save')[0] === 401, 'Sin sesión no guarda');
$_SESSION['usuario_id'] = 1;
callNotes('GET', '/notes');
checkNotes(callNotes('POST', '/notes/folder-save', [], false)[0] === 403, 'Exige CSRF');
for ($i = 1; $i <= 9; $i++) {
    [$status, $data] = callNotes('POST', '/notes/folder-save', ['nombre' => "Matemática $i", 'descripcion' => 'Descripción']);
    checkNotes($status === 200, 'Crear carpeta');
}
$folder = $data['id'];
checkNotes(count(callNotes('GET', '/notes')[1]['items']) === 4, 'Cuatro carpetas por página');
checkNotes(count(callNotes('GET', '/notes?page=2')[1]['items']) === 4, 'Segunda página');
checkNotes(count(callNotes('GET', '/notes?page=99')[1]['items']) === 1, 'Ajusta última página');
$body = ['nombre' => 'Álgebra <script>alert(1)</script>', 'descripcion' => 'Próxima clase', 'contenido' => str_repeat("Texto largo con ñ y fórmulas\n", 10000), 'carpeta_id' => $folder];
[$status, $saved] = callNotes('POST', '/notes/save', $body);
checkNotes($status === 200, 'Guarda texto largo');
$id = $saved['id'];
checkNotes(callNotes('GET', '/notes?id=' . $id)[1]['note']['contenido'] === $body['contenido'], 'Reabre todo el contenido sin truncar');
checkNotes(!isset(callNotes('GET', '/notes?folder=' . $folder)[1]['items'][0]['contenido']), 'Listado no descarga todo el texto');
$body['id'] = $id; $body['version'] = 1; $body['contenido'] .= 'Nuevo';
checkNotes(callNotes('POST', '/notes/save', $body)[1]['version'] === 2, 'Editar incrementa versión');
checkNotes(callNotes('POST', '/notes/save', $body)[0] === 409, 'Evita sobrescribir otra ventana');
$_SESSION['usuario_id'] = 2;
checkNotes(callNotes('GET', '/notes')[1]['total'] === 0, 'Cuenta distinta no lista carpetas ajenas');
checkNotes(callNotes('GET', '/notes?id=' . $id)[0] === 404, 'Cuenta distinta no lee apunte');
checkNotes(callNotes('GET', '/notes?folder=' . $folder)[0] === 404, 'Cuenta distinta no abre carpeta');
checkNotes(callNotes('POST', '/notes/save', $body)[0] === 404, 'Cuenta distinta no edita apunte');
checkNotes(callNotes('POST', '/notes/delete', ['id' => $id])[0] === 404, 'Cuenta distinta no borra apunte');
checkNotes(callNotes('POST', '/notes/folder-delete', ['id' => $folder])[0] === 404, 'Cuenta distinta no borra carpeta');
checkNotes(callNotes('POST', '/notes/folder-save', ['id' => $folder, 'nombre' => 'Ajena', 'descripcion' => ''])[0] === 404, 'Cuenta distinta no edita carpeta');
unset($body['id']);
checkNotes(callNotes('POST', '/notes/save', $body)[0] === 404, 'No crea apunte dentro de carpeta ajena');
$body['carpeta_id'] = 0;
checkNotes(callNotes('POST', '/notes/save', $body)[0] === 200, 'Permite apunte sin carpeta');
checkNotes(count(callNotes('GET', '/notes?folder=0')[1]['items']) === 1, 'Lista apuntes sin carpeta');
$_SESSION['usuario_id'] = 1;
checkNotes(callNotes('POST', '/notes/delete', ['id' => $id])[0] === 200, 'Dueño borra apunte');
checkNotes(callNotes('GET', '/notes?id=' . $id)[0] === 404, 'Apunte borrado no se puede recuperar');
checkNotes(callNotes('POST', '/notes/folder-delete', ['id' => $folder])[0] === 200, 'Dueño borra carpeta');
echo "$checks verificaciones correctas, sin modificar datos reales.\n";
