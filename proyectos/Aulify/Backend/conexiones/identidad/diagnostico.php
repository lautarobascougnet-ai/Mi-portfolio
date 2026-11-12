<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/Didit.php';
$config = \Aulify\Identidad\configuration();
// Solo indicadores: nunca imprimir el token, ni siquiera parcialmente.
$diagnosis = [
	'enabled' => $config['enabled'],
	'api_key_loaded' => is_string($config['api_key']) && strlen($config['api_key']) >= 16,
	'workflow_loaded' => preg_match('/^[a-f0-9-]{36}$/i', $config['workflow_id']) === 1,
	'environment' => in_array($config['environment'], ['sandbox', 'live'], true) ? $config['environment'] : 'invalid',
	'configuration_ready' => \Aulify\Identidad\isConfigured($config),
];
// Comprobación opcional de conexión: no envía credenciales ni crea sesiones.
if (in_array('--network', $argv, true)) {
	$curl = curl_init('https://verification.didit.me/');
	curl_setopt_array($curl, [
		CURLOPT_NOBODY => true, CURLOPT_RETURNTRANSFER => true,
		CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15,
		CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
	]);
	$result = curl_exec($curl);
	$diagnosis['tls_connection_ok'] = $result !== false && curl_getinfo($curl, CURLINFO_RESPONSE_CODE) > 0;
	$diagnosis['curl_error_number'] = curl_errno($curl);
	curl_close($curl);
}
echo json_encode($diagnosis, JSON_PRETTY_PRINT) . "\n";
