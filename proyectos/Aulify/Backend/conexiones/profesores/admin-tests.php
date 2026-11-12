<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../../../vendor/autoload.php';
require __DIR__ . '/../../base de datos/conexion.php';
// Copias temporales por conexión: nunca se revisan solicitudes reales.
foreach (['usuarios', 'solicitudes_profesor', 'aulify_administradores', 'aulify_materias', 'aulify_correos'] as $table) {
	$schema = $conexion->query("SHOW CREATE TABLE `$table`")->fetch_assoc()['Create Table'];
	$schema = preg_replace('/,\n\s+CONSTRAINT[^\n]+/', '', $schema);
	$conexion->query(str_replace('CREATE TABLE', 'CREATE TEMPORARY TABLE', $schema));
}
$hash = password_hash('solo-test-admin', PASSWORD_DEFAULT);
foreach ([1,2,3] as $id) $conexion->execute_query('INSERT INTO usuarios (id,nombre,apellido,email,username,password_hash,dni,fecha_usu,experiencia) VALUES (?,?,?,?,?,?,0,CURRENT_DATE,?)', [$id,'Prueba','Usuario',"test$id@example.invalid",$id===3?'admin':"test$id",$id===1?$hash:'sin-login','Información antigua conservada']);
$conexion->execute_query('INSERT INTO aulify_administradores VALUES (?)', [1]);
foreach ([2,3] as $id) $conexion->execute_query('INSERT INTO solicitudes_profesor (usuario_id,nombre_completo,nombre_usuario,experiencia,descripcion,motivacion,estudios) VALUES (?,?,?,?,?,?,?)', [$id,'Docente de prueba',"test$id",'Experiencia de prueba para enseñar.','Clases explicadas con ejemplos y ejercicios.','Quiero ayudar a que otras personas aprendan.','["secundaria"]']);
$app = \Slim\Factory\AppFactory::create();
$json = static function ($response, array $data, int $status=200) { $response->getBody()->write(json_encode($data)); return $response->withStatus($status); };
$authenticatedUserId = static fn(): int => (int) ($_SESSION['usuario_id'] ?? 0);
require __DIR__ . '/routes.php';
require __DIR__ . '/admin.php';
require __DIR__ . '/materias.php';
require __DIR__ . '/perfil-routes.php';
$_SESSION = [];
$checks=0;
function verifyAdmin(bool $ok, string $label): void { global $checks; if (!$ok) throw new RuntimeException($label); $checks++; }
function apiAdmin(string $method, string $path, array $body=[], bool $csrf=true) {
	global $app;
	$request=(new \Slim\Psr7\Factory\ServerRequestFactory())->createServerRequest($method,$path)->withParsedBody($body);
	if ($csrf) $request=$request->withHeader('X-CSRF-Token',$_SESSION['admin_csrf']??'');
	return $app->handle($request);
}
verifyAdmin(apiAdmin('GET','/admin/teachers')->getStatusCode()===403,'Sin sesión no ve solicitudes');
$_SESSION['usuario_id']=1;
verifyAdmin(apiAdmin('GET','/admin/teachers')->getStatusCode()===403,'Login común no equivale a acceso administrativo');
$session=json_decode((string)apiAdmin('GET','/admin/session')->getBody(),true);
verifyAdmin(!$session['authenticated'] && strlen($session['csrf'])===64,'CSRF público sin datos privados');
verifyAdmin(apiAdmin('POST','/admin/login',['username'=>'admin','password'=>'solo-test-admin'],false)->getStatusCode()===403,'CSRF requerido en login');
verifyAdmin(apiAdmin('POST','/admin/login',['username'=>'otro','password'=>'solo-test-admin'])->getStatusCode()===401,'Solo alias admin');
verifyAdmin(apiAdmin('POST','/admin/login',['username'=>'admin','password'=>'incorrecta'])->getStatusCode()===401,'Contraseña válida requerida');
verifyAdmin(apiAdmin('POST','/admin/login',['username'=>'admin','password'=>'solo-test-admin'])->getStatusCode()===200,'Acceso por cuenta autorizada incluso con username cambiado');
$list=json_decode((string)apiAdmin('GET','/admin/teachers')->getBody(),true);
verifyAdmin(count($list['applications'])===2,'Lista solicitudes');
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>2,'estado'=>'aprobada'],false)->getStatusCode()===403,'CSRF en decisiones');
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>2,'estado'=>'inventado'])->getStatusCode()===422,'Valida estado');
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>2,'estado'=>'aprobada','motivo'=>'Bienvenido'])->getStatusCode()===200,'Aprueba solicitud');
verifyAdmin((int)$conexion->query('SELECT COUNT(*) n FROM aulify_correos')->fetch_assoc()['n']===1,'Aprobación genera un aviso en cola');
$subject = aulifySubject($conexion,'Materia nueva de prueba',2);
verifyAdmin($subject['estado']==='pendiente','No autoaprueba materias');
verifyAdmin(aulifySubject($conexion,'MATERIA NUEVA DE PRUEBA',3)['id']===$subject['id'],'No duplica por mayúsculas');
verifyAdmin(apiAdmin('POST','/admin/subject-review',['id'=>$subject['id'],'estado'=>'aprobada'],false)->getStatusCode()===403,'Materia requiere CSRF');
verifyAdmin(apiAdmin('POST','/admin/subject-review',['id'=>$subject['id'],'estado'=>'aprobada'])->getStatusCode()===200,'Admin aprueba materia');
verifyAdmin(aulifySubject($conexion,'Materia nueva de prueba',2)['estado']==='aprobada','Profesor puede usar materia aceptada');
verifyAdmin(apiAdmin('POST','/admin/subject-review',['id'=>$subject['id'],'estado'=>'rechazada'])->getStatusCode()===409,'No sobrescribe revisión');
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>2,'estado'=>'rechazada'])->getStatusCode()===409,'No reescribe decisión ya tomada');
$_SESSION['usuario_id']=2;
$application=json_decode((string)apiAdmin('GET','/teacher/application')->getBody(),true)['application'];
verifyAdmin($application['estado']==='aprobada' && $application['revision_motivo']==='Bienvenido','Solicitante recibe decisión y motivo');
verifyAdmin(aulifyProfile($conexion,2)['tipo']==='Profesor','Rol derivado de aprobación');
verifyAdmin(aulifyProfile($conexion,2)['experiencia']==='Información antigua conservada','No borra perfil anterior');
verifyAdmin(apiAdmin('POST','/user/profile',['experiencia'=>'Nueva experiencia docente','titulos'=>'Título de prueba','descripcion'=>'Descripción de profesor'])->getStatusCode()===200,'Profesor puede editar campos profesionales');
verifyAdmin(apiAdmin('POST','/user/profile',['descripcion'=>''])->getStatusCode()===200 && aulifyProfile($conexion,2)['descripcion']==='','Profesor puede vaciar descripción');
$_SESSION['usuario_id']=3;
verifyAdmin(aulifyProfile($conexion,3)['tipo']==='Alumno' && !array_key_exists('experiencia',aulifyProfile($conexion,3)),'Alumno solo obtiene campos básicos');
verifyAdmin(apiAdmin('POST','/user/profile',['experiencia'=>'No autorizado'])->getStatusCode()===403,'Alumno no escribe campos de profesor');
verifyAdmin(apiAdmin('POST','/user/profile',['rating'=>5])->getStatusCode()===403,'No se autocalifica');
verifyAdmin(apiAdmin('POST','/user/profile',['is_professor'=>true])->getStatusCode()===403,'No se autoasigna rol');
verifyAdmin(apiAdmin('POST','/user/profile',['nombre'=>'Nuevo','apellido'=>'Apellido','email'=>'nuevo@example.invalid'])->getStatusCode()===200,'Alumno modifica datos básicos');
verifyAdmin(aulifyProfile($conexion,3)['rating']===null,'Guardar no convierte sin calificación en cero');
verifyAdmin($conexion->query('SELECT experiencia FROM usuarios WHERE id=3')->fetch_assoc()['experiencia']==='Información antigua conservada','No borra datos profesionales históricos');
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>3,'estado'=>'rechazada','motivo'=>'Falta documentación'])->getStatusCode()===200,'Deniega solicitud');
$application=json_decode((string)apiAdmin('GET','/teacher/application')->getBody(),true)['application'];
verifyAdmin($application['estado']==='rechazada' && $application['revision_motivo']==='Falta documentación','Notifica rechazo');
verifyAdmin(apiAdmin('POST','/admin/logout')->getStatusCode()===200,'Logout administrativo');
verifyAdmin(apiAdmin('GET','/admin/teachers')->getStatusCode()===403,'Logout invalida acceso');
verifyAdmin(apiAdmin('GET','/admin/teacher-title?user_id=2')->getStatusCode()===403,'Adjuntos privados');
// El usuario 3 se llama admin, pero no tiene el permiso ni la sesión administrativa.
verifyAdmin(apiAdmin('POST','/admin/teacher-review',['user_id'=>3,'estado'=>'aprobada'])->getStatusCode()===403,'Nombre admin no otorga permisos');
apiAdmin('POST','/admin/login',['username'=>'admin','password'=>'solo-test-admin']);
$_SESSION['admin_expires']=time()-1;
verifyAdmin(apiAdmin('GET','/admin/teachers')->getStatusCode()===403,'Expiración de sesión');
echo "$checks comprobaciones correctas. Solo tablas temporales; sin decisiones reales.\n";
