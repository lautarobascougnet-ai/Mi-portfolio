<?php
declare(strict_types=1);

namespace Aulify\Identidad;

final class IdentityError extends \RuntimeException
{
	public function __construct(public readonly string $reason, string $message, int $status = 400)
	{
		parent::__construct($message, $status);
	}
}

function configuration(): array
{
	$config = require __DIR__ . '/config.example.php';
	if (is_file(__DIR__ . '/config.local.php')) $config = array_replace($config, require __DIR__ . '/config.local.php');
	if ($config['public_base_url'] === '') {
		$local = dirname(__DIR__, 3) . '/porteo/estado/config.json';
		if (is_file($local)) {
			$network = json_decode(file_get_contents($local), true);
			$config['public_base_url'] = 'https://' . $network['ip'] . ':' . $network['httpsPort'] . rtrim($network['projectPath'], '/');
		}
	}
	return $config;
}

function isConfigured(array $config): bool
{
	return $config['enabled'] === true && is_string($config['api_key']) && strlen($config['api_key']) >= 16
		&& preg_match('/^[a-f0-9-]{36}$/i', $config['workflow_id']) === 1
		&& in_array($config['environment'], ['sandbox', 'live'], true)
		&& preg_match('~^https://[^/?#]+(?:/[^?#]*)?$~', $config['public_base_url']) === 1;
}

// REST servidor a servidor: host fijo, TLS verificado, sin redirecciones ni logs de biometría.
final class DiditClient
{
	public function __construct(private array $config) {}

	public function request(string $method, string $path, ?array $body = null): array
	{
		if (!preg_match('~^session/(?:[a-f0-9-]{36}/decision/)?$~i', $path)) throw new \LogicException('Ruta Didit inválida');
		$curl = curl_init('https://verification.didit.me/v3/' . $path);
		curl_setopt_array($curl, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CUSTOMREQUEST => $method,
			CURLOPT_CONNECTTIMEOUT => 5,
			CURLOPT_TIMEOUT => 15,
			CURLOPT_FOLLOWLOCATION => false,
			CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
			CURLOPT_SSL_VERIFYPEER => true,
			CURLOPT_SSL_VERIFYHOST => 2,
			CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'x-api-key: ' . $this->config['api_key']],
		]);
		if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
		$raw = curl_exec($curl);
		$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
		curl_close($curl);
		if ($raw === false || $status < 200 || $status >= 300) {
			throw new IdentityError('DIDIT_UNAVAILABLE', 'No se pudo consultar Didit. Revisá la conexión o la configuración y volvé a intentar.', 503);
		}
		$result = json_decode($raw, true);
		if (!is_array($result)) throw new IdentityError('DIDIT_INVALID_RESPONSE', 'Didit devolvió una respuesta inesperada.', 502);
		return $result;
	}
}

// Política cerrada: nunca acepta un status que venga del navegador o del callback.
final class Decision
{
	private static function normalizeName(string $value): string
	{
		$value = strtr(mb_strtolower($value, 'UTF-8'), ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u']);
		return trim(preg_replace('/\s+/u', ' ', $value));
	}

	public static function evaluate(array $report, array $attempt, array $person): string
	{
		if (($report['session_id'] ?? '') !== $attempt['didit_session_id']
			|| ($report['vendor_data'] ?? '') !== $attempt['id']
			|| ($report['workflow_id'] ?? '') !== $attempt['workflow_id']
			|| ($report['session_kind'] ?? '') !== 'user'
			|| ($report['environment'] ?? '') !== $attempt['entorno']) return 'invalid_result';
		$status = strtolower((string) ($report['status'] ?? ''));
		if (in_array($status, ['declined', 'expired', 'abandoned', 'kyc expired'], true)) return 'declined';
		if ($status === 'in review') return 'in_review';
		if ($status !== 'approved') return 'pending';
		// Un workflow simple: un DNI, una prueba de vida y una comparación con ese DNI.
		foreach (['id_verifications', 'liveness_checks', 'face_matches'] as $key) {
			$checks = $report[$key] ?? null;
			if (!is_array($checks) || count($checks) !== 1 || !isset($checks[0])
				|| strtolower((string) ($checks[0]['status'] ?? '')) !== 'approved') return 'incomplete_checks';
		}
		$face = $report['face_matches'][0];
		if (!array_key_exists('source_image_session_id', $face) || $face['source_image_session_id'] !== null) return 'incomplete_checks';
		$id = $report['id_verifications'][0];
		if (($id['issuing_state'] ?? '') !== 'ARG' || !in_array($id['document_type'] ?? '', ['Identity Card', 'ID'], true)) return 'document_mismatch';
		$number = preg_replace('/[.\s-]/', '', (string) ($id['document_number'] ?? ''));
		if (!ctype_digit($number) || ltrim($number, '0') !== ltrim($person['dni'], '0')) return 'document_mismatch';
		if (self::normalizeName((string) ($id['first_name'] ?? '')) !== self::normalizeName($person['nombre'])
			|| self::normalizeName((string) ($id['last_name'] ?? '')) !== self::normalizeName($person['apellido'])) return 'document_mismatch';
		$expiry = $id['expiration_date'] ?? '';
		if (!is_string($expiry) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiry) || $expiry < gmdate('Y-m-d')) return 'document_mismatch';
		return $attempt['entorno'] === 'sandbox' ? 'test_passed' : 'approved';
	}
}
