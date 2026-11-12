<?php
// Pruebas aisladas: las tablas temporales desaparecen al cerrar esta conexión.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../../vendor/autoload.php';
require __DIR__ . '/../../base de datos/conexion.php';
foreach (['usuarios', 'solicitudes_profesor', 'aulify_clases', 'aulify_reservas', 'aulify_reserva_mensajes', 'aulify_materias'] as $table) {
    $schema = $conexion->query("SHOW CREATE TABLE `$table`")->fetch_assoc()['Create Table'];
    $schema = preg_replace('/^\s+CONSTRAINT[^\n]*\n/m', '', $schema);
    $schema = preg_replace('/,\n\)/', "\n)", $schema);
    $schema = preg_replace('/ AUTO_INCREMENT=\d+/', '', $schema);
    $conexion->query(str_replace('CREATE TABLE', 'CREATE TEMPORARY TABLE', $schema));
}
$conexion->query("INSERT INTO usuarios (id,nombre,apellido,email,password_hash,dni,fecha_usu) VALUES (1,'Alumno','Prueba','alumno@example.invalid','x',0,CURRENT_DATE),(2,'Profesor','Prueba','profe@example.invalid','x',0,CURRENT_DATE),(3,'Otro','Profesor','otro@example.invalid','x',0,CURRENT_DATE)");
$conexion->query("UPDATE usuarios SET rating=4.5, foto_perfil='Backend/conexiones/uploads/perfiles/prueba.png' WHERE id=2");
$conexion->query("INSERT INTO solicitudes_profesor (usuario_id,nombre_completo,nombre_usuario,experiencia,descripcion,motivacion,estudios,estado) VALUES (2,'Profesor Prueba','profe','Experiencia','Descripción','Motivación','[]','aprobada'),(3,'Otro Profesor','otro','Experiencia','Descripción','Motivación','[]','aprobada')");
$app = \Slim\Factory\AppFactory::create();
$json = static function ($response, $data, $status = 200) { $response->getBody()->write(json_encode($data)); return $response->withStatus($status); };
$authenticatedUserId = static fn(): int => (int) ($_SESSION['usuario_id'] ?? 0);
require __DIR__ . '/routes.php';
$adminId = static fn() => 0;
$adminCsrf = static fn() => false;
require __DIR__ . '/../profesores/materias.php';
$checks = 0;
function check($value, $message) { global $checks; if (!$value) throw new RuntimeException($message); $checks++; }
function callClass($method, $path, $data = [], $csrf = true) {
    global $app;
    $request = (new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method, $path)->withParsedBody($data);
    if ($csrf) $request = $request->withHeader('X-CSRF-Token', $_SESSION['classes_csrf'] ?? '');
    return $app->handle($request);
}
$body = ['materia' => 'Clash Royale', 'descripcion' => 'Una clase de prueba de estrategia.', 'precio' => '75.50', 'moneda' => 'USD', 'modalidad' => 'virtual', 'profesor_id' => 1];
$today = (new DateTimeImmutable('today', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
$body['horarios'] = ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [1 => [['start' => '08:30', 'end' => '16:30']]], 'exceptions' => [$today => []]];
$_SESSION = [];
check(callClass('GET', '/classes')->getStatusCode() === 200, 'Catálogo público');
check(callClass('GET', '/classes/mine')->getStatusCode() === 401, 'Listado privado');
check(callClass('POST', '/classes', $body)->getStatusCode() === 401, 'Crear requiere sesión');
$_SESSION['usuario_id'] = 1;
$mine = json_decode((string) callClass('GET', '/classes/mine')->getBody(), true);
check(!$mine['is_professor'] && !$mine['classes'] && !$mine['scheduled'], 'Alumno sin clases propias ni reservas ficticias');
check(callClass('POST', '/classes', $body)->getStatusCode() === 403, 'Alumno no puede crear');
$_SESSION['usuario_id'] = 2;
callClass('GET', '/classes/mine');
check(callClass('POST', '/subjects/request', ['nombre' => 'Materia propuesta'])->getStatusCode() === 200, 'Profesor aprobado puede proponer una materia');
$proposal = json_decode((string) callClass('POST', '/subjects/request', ['nombre' => 'Materia propuesta'])->getBody(), true);
check($proposal['subject']['estado'] === 'pendiente', 'La materia propuesta queda pendiente de aprobación');
check(callClass('POST','/classes',$body)->getStatusCode()===409,'Materia nueva necesita revisión');
check((int)$conexion->query('SELECT COUNT(*) n FROM aulify_clases')->fetch_assoc()['n']===0,'No publica clase pendiente');
check(aulifySubject($conexion,'Clash Royale',2)['estado']==='pendiente','Propuesta visible para revisión');
$conexion->query("UPDATE aulify_materias SET estado='aprobada'");
check(callClass('POST', '/classes', $body, false)->getStatusCode() === 403, 'CSRF obligatorio');
check(callClass('POST', '/classes', array_merge($body, ['precio' => -1]))->getStatusCode() === 422, 'Precio inválido');
check(callClass('POST', '/classes', array_merge($body, ['moneda' => 'GBP']))->getStatusCode() === 422, 'Moneda no admitida');
check(callClass('POST', '/classes', array_merge($body, ['materia' => []]))->getStatusCode() === 422, 'Tipo inválido');
foreach ([
    null,
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [], 'exceptions' => []],
    ['timezone' => 'UTC', 'weekly' => [1 => [['start' => '08:00', 'end' => '09:00']]], 'exceptions' => []],
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [8 => [['start' => '08:00', 'end' => '09:00']]], 'exceptions' => []],
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [1 => [['start' => '17:00', 'end' => '08:00']]], 'exceptions' => []],
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [1 => [['start' => '08:00', 'end' => '10:00'], ['start' => '09:00', 'end' => '11:00']]], 'exceptions' => []],
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [], 'exceptions' => ['2020-01-01' => [['start' => '08:00', 'end' => '09:00']]]],
    ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [], 'exceptions' => ['2099-02-30' => [['start' => '08:00', 'end' => '09:00']]]],
] as $invalid) {
    check(callClass('POST', '/classes', array_merge($body, ['horarios' => $invalid]))->getStatusCode() === 422, 'Horarios inválidos rechazados');
}
check((int) $conexion->query('SELECT COUNT(*) n FROM aulify_clases')->fetch_assoc()['n'] === 0, 'Un error de horarios no publica la clase');
check(callClass('POST', '/classes', $body)->getStatusCode() === 201, 'Creación de materia nueva');
$catalog = json_decode((string) callClass('GET', '/classes')->getBody(), true)['classes'];
check(count($catalog) === 1 && $catalog[0]['materia'] === 'Clash Royale', 'Persistencia en catálogo');
check($catalog[0]['moneda'] === 'USD', 'La moneda elegida se guarda y aparece en el catálogo');
$storedSchedule = json_decode($catalog[0]['horarios'], true);
check($storedSchedule === $body['horarios'], 'Persistencia exacta de semana, minutos, zona y excepciones');
$free = ['timezone' => 'America/Argentina/Buenos_Aires', 'weekly' => [], 'exceptions' => [$today => [['start' => '23:15', 'end' => '24:00']]]];
check(aulifyValidateSchedule($free)['exceptions']->{$today}[0]['end'] === '24:00', 'Modo libre y final de día válidos');
check((int) $catalog[0]['profesor_id'] === 2 && !isset($catalog[0]['email']), 'Propietario de sesión y privacidad');
check((float) $catalog[0]['rating'] === 4.5 && $catalog[0]['foto_perfil'] === 'Backend/conexiones/uploads/perfiles/prueba.png', 'Foto y puntuación del perfil en catálogo');
$conexion->query("UPDATE usuarios SET rating=3.5, foto_perfil=NULL WHERE id=2");
$updated = json_decode((string) callClass('GET', '/classes')->getBody(), true)['classes'][0];
check((float) $updated['rating'] === 3.5 && $updated['foto_perfil'] === null, 'Los cambios de perfil se reflejan sin duplicar datos');
check(count(json_decode((string) callClass('GET', '/classes/mine')->getBody(), true)['classes']) === 1, 'Profesor ve su clase');
$_SESSION['usuario_id'] = 3;
check(!json_decode((string) callClass('GET', '/classes/mine')->getBody(), true)['classes'], 'Otro profesor no ve clases ajenas como propias');
$conexion->query("UPDATE solicitudes_profesor SET estado='rechazada' WHERE usuario_id=2");
$_SESSION['usuario_id'] = 2;
check(callClass('POST', '/classes', $body)->getStatusCode() === 403, 'Permiso revocado');
check(!json_decode((string) callClass('GET', '/classes')->getBody(), true)['classes'], 'Solo profesores aprobados en catálogo');
echo "$checks pruebas de clases correctas; sin modificar datos reales.\n";
