<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/Didit.php';
require __DIR__ . '/Registration.php';
require __DIR__ . '/../../base de datos/conexion.php';

use Aulify\Identidad\Decision;
use Aulify\Identidad\Registration;
use Aulify\Identidad\IdentityError;

// Tablas TEMPORARY: ocultan las reales solo en esta conexión y desaparecen al cerrarla.
// Nunca modifica usuarios reales ni llama a Didit.
$conexion->query('CREATE TEMPORARY TABLE usuarios (id BIGINT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(255), apellido VARCHAR(255), email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), dni BIGINT, fecha_usu DATE) ENGINE=InnoDB');
$sql = str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', file_get_contents(__DIR__ . '/schema.sql'));
foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $conexion->query($statement);
$checks = 0;
function check(bool $condition, string $label): void {
	global $checks;
	if (!$condition) throw new RuntimeException('FALLÓ: ' . $label);
	$checks++;
}
function rejected(Closure $action, string $reason): void {
	try { $action(); } catch (IdentityError $e) { check($e->reason === $reason, $reason); return; }
	throw new RuntimeException('No rechazó: ' . $reason);
}
$config = ['enabled'=>true, 'api_key'=>str_repeat('test-only-', 4), 'workflow_id'=>'11111111-2222-3333-4444-555555555555', 'environment'=>'live', 'public_base_url'=>'https://localhost/aulify', 'max_sessions_per_hour'=>100];
$person = ['nombre'=>'María', 'apellido'=>'Pérez', 'email'=>'identity-test@example.invalid', 'dni'=>'12345678', 'password'=>'PruebaLocal123!', 'password_confirm'=>'PruebaLocal123!', 'consent'=>true];
$sessions = [];
$payloads = [];
$postCalls = 0;
$getCalls = 0;
$provider = function ($method, $path, $body) use (&$sessions, &$payloads, &$postCalls, &$getCalls, $config) {
	if ($method === 'POST') {
		$payloads[] = $body;
		$postCalls++;
		$id = sprintf('00000000-0000-4000-8000-%012d', $postCalls);
		$sessions[$id] = ['session_id'=>$id, 'vendor_data'=>$body['vendor_data'], 'workflow_id'=>$config['workflow_id'], 'session_kind'=>'user', 'environment'=>'live', 'status'=>'Approved',
			'id_verifications'=>[['status'=>'Approved', 'issuing_state'=>'ARG', 'document_type'=>'Identity Card', 'document_number'=>'12.345.678', 'first_name'=>'MARIA', 'last_name'=>'PEREZ', 'expiration_date'=>'2035-01-01']],
			'liveness_checks'=>[['status'=>'Approved']], 'face_matches'=>[['status'=>'Approved', 'source_image_session_id'=>null]]];
		check(!isset($body['contact_details']) && !isset($body['portrait_image']), 'no se envía email ni foto desde Aulify');
		check($body['expected_details']['expected_document_types'] === ['ID'], 'solo DNI');
		return ['session_id'=>$id, 'url'=>'https://verify.didit.me/es/session/TestToken123', 'vendor_data'=>$body['vendor_data'], 'workflow_id'=>$config['workflow_id']];
	}
	$getCalls++;
	return $sessions[explode('/', $path)[1]];
};
$service = new Registration($conexion, $config, $provider);
$attempt = $service->start($person, 'owner-one');
check(strlen($attempt['ticket']) === 64, 'ticket impredecible');
$saved = $conexion->query('SELECT * FROM aulify_registros_pendientes')->fetch_assoc();
check(!str_contains($saved['datos'], 'PruebaLocal123!'), 'contraseña no almacenada en claro');
check($saved['ticket_hash'] !== $attempt['ticket'], 'ticket hasheado');
rejected(fn()=>$service->launch($attempt['ticket'], true, false, false), 'MOBILE_REQUIRED');
rejected(fn()=>$service->launch($attempt['ticket'], false, true, true), 'CONSENT_REQUIRED');
$url = $service->launch($attempt['ticket'], true, true, true);
check(!isset($payloads[0]['sandbox_scenario']), 'Live no envía escenarios simulados');
check($service->launch($attempt['ticket'], true, true, true) === $url && $postCalls === 1, 'doble click no duplica sesión');
check($service->status($attempt['ticket'])['state'] === 'completed', 'aprobado live simulado crea cuenta temporal');
check($service->status($attempt['ticket'])['state'] === 'completed' && $getCalls === 1, 'replay idempotente');
check((int)$conexion->query('SELECT COUNT(*) n FROM usuarios')->fetch_assoc()['n'] === 1, 'una sola cuenta');
check($conexion->query('SELECT datos FROM aulify_registros_pendientes')->fetch_assoc()['datos'] === null, 'datos temporales eliminados');

$saved['didit_session_id'] = array_key_first($sessions);
$saved['workflow_id'] = $config['workflow_id'];
$base = $sessions[$saved['didit_session_id']];
foreach (['session_id','vendor_data','workflow_id','environment','session_kind'] as $field) {
	$bad = $base; $bad[$field] = 'alterado';
	check(Decision::evaluate($bad, $saved, $person) === 'invalid_result', 'correlación ' . $field);
}
foreach (['id_verifications','liveness_checks','face_matches'] as $field) {
	$bad = $base; unset($bad[$field]);
	check(Decision::evaluate($bad, $saved, $person) === 'incomplete_checks', 'no se omite ' . $field);
	$bad = $base; $bad[$field][0]['status'] = 'Declined';
	check(Decision::evaluate($bad, $saved, $person) === 'incomplete_checks', 'rechazo individual ' . $field);
}
foreach (['document_number'=>'99999999', 'issuing_state'=>'ESP', 'document_type'=>'Passport', 'first_name'=>'Otra', 'last_name'=>'Persona', 'expiration_date'=>'2001-01-01'] as $field=>$value) {
	$bad = $base; $bad['id_verifications'][0][$field] = $value;
	check(Decision::evaluate($bad, $saved, $person) === 'document_mismatch', 'documento ' . $field);
}
$bad = $base; $bad['face_matches'][0]['source_image_session_id'] = 'other';
check(Decision::evaluate($bad, $saved, $person) === 'incomplete_checks', 'no comparación contra otra sesión');
foreach (['In Review'=>'in_review', 'Declined'=>'declined', 'Not Started'=>'pending', 'Not Finished'=>'pending', 'Approved?'=>'pending'] as $value=>$expected) {
	$bad = $base; $bad['status'] = $value;
	check(Decision::evaluate($bad, $saved, $person) === $expected, 'estado ' . $value);
}

$sandboxConfig = $config; $sandboxConfig['environment'] = 'sandbox';
$sandbox = new Registration($conexion, $sandboxConfig, $provider);
$p = $person; $p['email'] = 'sandbox@example.invalid';
$test = $sandbox->start($p, 'owner-two');
$sandbox->launch($test['ticket'], true, true, false);
check($payloads[array_key_last($payloads)]['sandbox_scenario'] === 'approve', 'Sandbox exige validación del entorno al crear sesión');
$sessions[array_key_last($sessions)]['environment'] = 'sandbox';
check($sandbox->status($test['ticket'])['state'] === 'test_passed', 'sandbox explícito');
check((int)$conexion->query('SELECT COUNT(*) n FROM usuarios')->fetch_assoc()['n'] === 1, 'sandbox no crea usuarios');
$demo = $sandbox->startSandboxDemo('owner-demo');
$demoRow = $conexion->execute_query('SELECT * FROM aulify_registros_pendientes WHERE ticket_hash=?', [hash('sha256', $demo['ticket'])])->fetch_assoc();
$demoPerson = json_decode($demoRow['datos'], true);
check($demoRow['entorno'] === 'sandbox' && $demoRow['consentimiento'] === 'sandbox-demo-no-personal-data', 'Demo solo guarda el consentimiento específico de Sandbox');
check((bool) preg_match('/^demo-[a-f0-9]{32}@example\.invalid$/', $demoPerson['email']) && $demoPerson['nombre'] === 'María' && $demoPerson['dni'] === '12345678', 'Demo usa datos ficticios');
rejected(fn()=>(new Registration($conexion, $config, $provider))->startSandboxDemo('owner-live'), 'SANDBOX_REQUIRED');
check((int)$conexion->query('SELECT COUNT(*) n FROM usuarios')->fetch_assoc()['n'] === 1, 'Demo Sandbox no crea una cuenta');
$sandbox->launch($demo['ticket'], false, true, true);
$sessions[array_key_last($sessions)]['environment'] = 'sandbox';
check($sandbox->status($demo['ticket'])['state'] === 'test_passed', 'Demo permite verificar el QR sin datos reales');
check((int)$conexion->query('SELECT COUNT(*) n FROM usuarios')->fetch_assoc()['n'] === 1, 'Demo completada sigue sin crear una cuenta');

$p['email'] = 'cancel@example.invalid';
$cancel = $service->start($p, 'owner-three');
check($service->cancel($cancel['ticket'])['state'] === 'cancelled', 'cancelación');
rejected(fn()=>$service->launch($cancel['ticket'], true, true, true), 'CLOSED_ATTEMPT');
rejected(fn()=>$service->context(str_repeat('a',64)), 'INVALID_TICKET');

// Fallas del proveedor, datos inválidos y límites: siempre cerrar sin crear usuarios.
$invalid = $person; $invalid['consent'] = false;
rejected(fn()=>$service->start($invalid, 'invalid-owner'), 'CONSENT_REQUIRED');
foreach (['email'=>'invalid', 'dni'=>'123', 'password_confirm'=>'otra', 'nombre'=>''] as $field=>$value) {
	$invalid = $person; $invalid[$field] = $value;
	rejected(fn()=>$service->start($invalid, 'invalid-owner'), 'INVALID_FORM');
}
rejected(fn()=>$service->start($person, 'another-owner'), 'EMAIL_EXISTS');
$p['email'] = 'limits@example.invalid';
for ($i = 0; $i < 3; $i++) $service->start($p, 'limited-owner');
rejected(fn()=>$service->start($p, 'limited-owner'), 'RATE_LIMIT');
$p['email'] = 'unavailable@example.invalid';
$failed = $service->start($p, 'failed-owner');
$failingProvider = static function () { throw new IdentityError('DIDIT_UNAVAILABLE', 'Fallo simulado', 503); };
rejected(fn()=>(new Registration($conexion,$config,$failingProvider))->launch($failed['ticket'],true,true,true), 'DIDIT_UNAVAILABLE');
check($service->context($failed['ticket'])['started'] === false, 'fallo externo no deja sesión local abierta');
$untrustedProvider = static fn() => ['session_id'=>'00000000-0000-4000-8000-000000000099', 'url'=>'https://untrusted.example/session/unsafe'];
rejected(fn()=>(new Registration($conexion,$config,$untrustedProvider))->launch($failed['ticket'],true,true,true), 'DIDIT_INVALID_RESPONSE');
$limited = $config; $limited['max_sessions_per_hour'] = 1;
rejected(fn()=>(new Registration($conexion,$limited,$provider))->launch($failed['ticket'],true,true,true), 'SESSION_LIMIT');
$service->launch($failed['ticket'],true,true,true);
$sessions[array_key_last($sessions)]['status'] = 'Not Started';
$queriesBefore = $getCalls;
check($service->status($failed['ticket'])['state'] === 'pending', 'pendiente no habilita cuenta');
check($service->status($failed['ticket'])['state'] === 'pending' && $getCalls === $queriesBefore + 1, 'consultas consecutivas limitadas');
$service->cancel($failed['ticket']);
$sessions[array_key_last($sessions)]['status'] = 'Approved';
check($service->status($failed['ticket'])['state'] === 'cancelled', 'aprobación posterior no revive intento cancelado');
check((int)$conexion->query('SELECT COUNT(*) n FROM usuarios')->fetch_assoc()['n'] === 1, 'fallas, pendientes y cancelaciones no crean usuarios');

$conexion->query('UPDATE aulify_registros_pendientes SET expira = 1');
rejected(fn()=>$service->context($cancel['ticket']), 'EXPIRED_TICKET');
$service->cleanup();
check((int)$conexion->query('SELECT COUNT(*) n FROM aulify_registros_pendientes WHERE datos IS NOT NULL')->fetch_assoc()['n'] === 0, 'purga de vencidos');
$off = $config; $off['enabled'] = false;
rejected(fn()=>(new Registration($conexion,$off,$provider))->start($person,'owner'), 'IDENTITY_NOT_CONFIGURED');
echo "$checks comprobaciones correctas. Sin llamadas externas ni cambios en usuarios reales.\n";
