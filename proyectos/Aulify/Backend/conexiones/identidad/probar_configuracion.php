<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/Didit.php';
$config = \Aulify\Identidad\configuration();
// Diagnóstico con salidas limitadas: no imprime claves, URLs privadas ni datos personales.
function providerCheck(string $method, string $path, ?array $body = null): array {
	global $config;
	$curl = curl_init('https://verification.didit.me/v3/' . $path);
	curl_setopt_array($curl, [
		CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
		CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 20, CURLOPT_FOLLOWLOCATION => false,
		CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
		CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'x-api-key: ' . $config['api_key']],
	]);
	if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
	$raw = curl_exec($curl);
	$http = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
	$errno = curl_errno($curl);
	curl_close($curl);
	$data = is_string($raw) ? json_decode($raw, true) : null;
	if ($http < 200 || $http >= 300 || !is_array($data)) {
		$message = strtolower(is_string($raw) ? $raw : '');
		$summary = is_array($data) ? array_intersect_key($data, array_flip(['detail', 'error', 'sandbox_scenario'])) : [];
		$summary = str_replace([$config['api_key'], $config['workflow_id']], '[REDACTED]', json_encode($summary, JSON_UNESCAPED_UNICODE));
		$summary = preg_replace('~https?://[^\s"\\\\]+~', '[URL]', $summary);
		echo json_encode(['ok'=>false, 'http'=>$http, 'curl_error'=>$errno,
			'error_summary'=>substr($summary, 0, 500),
			'authentication_or_permissions'=>$http === 401 || $http === 403,
			'mentions_sandbox'=>str_contains($message, 'sandbox'),
			'mentions_live'=>str_contains($message, 'live'),
			'mentions_workflow'=>str_contains($message, 'workflow'),
		], JSON_PRETTY_PRINT) . "\n";
		exit(1);
	}
	return $data;
}
if (($config['environment'] ?? '') !== 'sandbox') { echo "Solo se permite comprobar Sandbox.\n"; exit(1); }
$candidate = $config; $candidate['enabled'] = true;
if (!\Aulify\Identidad\isConfigured($candidate)) { echo "Falta configuración válida.\n"; exit(1); }
if (in_array('--flow', $argv, true)) {
	// Flujo real contra Sandbox con almacenamiento temporal: nunca crea usuarios reales.
	require __DIR__ . '/Registration.php';
	require __DIR__ . '/../../base de datos/conexion.php';
	$conexion->query('CREATE TEMPORARY TABLE usuarios (id BIGINT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) UNIQUE) ENGINE=InnoDB');
	$sql = str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', file_get_contents(__DIR__ . '/schema.sql'));
	foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $conexion->query($statement);
	$service = new \Aulify\Identidad\Registration($conexion, $config);
	$attempt = null;
	try {
		$attempt = $service->start(['nombre'=>'Prueba', 'apellido'=>'Sandbox', 'email'=>'qa@example.invalid', 'dni'=>'12345678',
			'password'=>'SoloPruebaTemporal123!', 'password_confirm'=>'SoloPruebaTemporal123!', 'consent'=>true], 'sandbox-cli');
		$result = $service->launch($attempt['ticket'], true, true, true);
		$state = $service->status($attempt['ticket'])['state'];
		if ($state !== 'pending') throw new \RuntimeException('Estado inicial inesperado.');
		$cancelled = $service->cancel($attempt['ticket'])['state'] === 'cancelled';
		echo json_encode(['flow_started'=>true, 'provider_url_validated'=>isset($result['url']),
			'initial_state'=>$state, 'local_attempt_cancelled'=>$cancelled, 'real_users_created'=>false,
			'biometrics_uploaded'=>false], JSON_PRETTY_PRINT) . "\n";
	} catch (\Throwable $error) {
		if ($attempt !== null) $service->cancel($attempt['ticket']);
		echo json_encode(['flow_started'=>false, 'error_code'=>$error instanceof \Aulify\Identidad\IdentityError ? $error->reason : 'TEST_FAILED']) . "\n";
		exit(1);
	}
	exit;
}
if (!in_array('--session', $argv, true)) {
	$data = providerCheck('GET', 'workflows/');
	$found = array_values(array_filter($data['results'] ?? [], static fn($row) => ($row['workflow_id'] ?? '') === $config['workflow_id']));
	echo json_encode(['authentication_ok'=>true, 'workflow_found'=>count($found)>0,
		'versions'=>array_map(static fn($row) => array_intersect_key($row, array_flip(['status','features','is_archived','is_simple_workflow'])), $found),
	], JSON_PRETTY_PRINT) . "\n";
	exit(count($found)>0 ? 0 : 1);
}
// Este parámetro es rechazado por Didit si la clave pertenece a una aplicación Live.
// No sube imágenes, no ejecuta controles biométricos ni crea usuarios en Aulify.
$vendor = 'aulify-config-test-' . substr(hash('sha256', $config['workflow_id']), 0, 16);
$result = providerCheck('POST', 'session/', [
	'workflow_id'=>$config['workflow_id'], 'vendor_data'=>$vendor, 'sandbox_scenario'=>'approve',
	'language'=>'es', 'expected_details'=>['id_country'=>'ARG', 'expected_document_types'=>['ID']],
]);
$session = $result['session_id'] ?? '';
if (!is_string($session) || !preg_match('/^[a-f0-9-]{36}$/i', $session)) { echo "Respuesta de sesión inesperada.\n"; exit(1); }
$report = providerCheck('GET', 'session/' . $session . '/decision/');
$ok = ($report['environment'] ?? '') === 'sandbox' && ($report['workflow_id'] ?? '') === $config['workflow_id'] && ($report['vendor_data'] ?? '') === $vendor;
echo json_encode(['sandbox_confirmed'=>$ok, 'session_created'=>true, 'identity_verified'=>false], JSON_PRETTY_PRINT) . "\n";
exit($ok ? 0 : 1);
