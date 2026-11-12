<?php
declare(strict_types=1);

namespace Aulify\Identidad;

final class Registration
{
	public const CONSENT = 'didit-dni-selfie-2026-10-06';
	private \Closure $provider;

	// La inyección del transporte permite pruebas aisladas, no un modo falso en la API.
	public function __construct(private \mysqli $db, private array $config, ?\Closure $provider = null)
	{
		$this->provider = $provider ?? (new DiditClient($config))->request(...);
	}

	private function ready(): void
	{
		if (!isConfigured($this->config)) throw new IdentityError('IDENTITY_NOT_CONFIGURED', 'La verificación todavía no está habilitada. Falta configurar la cuenta de Didit.', 503);
	}

	private function one(string $sql, array $params = []): ?array
	{
		return $this->db->execute_query($sql, $params)->fetch_assoc();
	}

	private function ticket(string $ticket, bool $lock = false): array
	{
		if (!preg_match('/^[a-f0-9]{64}$/', $ticket)) throw new IdentityError('INVALID_TICKET', 'El enlace no es válido.', 404);
		$row = $this->one('SELECT * FROM aulify_registros_pendientes WHERE ticket_hash = ?' . ($lock ? ' FOR UPDATE' : ''), [hash('sha256', $ticket)]);
		if (!$row) throw new IdentityError('INVALID_TICKET', 'El enlace no es válido.', 404);
		if ((int) $row['expira'] < time()) throw new IdentityError('EXPIRED_TICKET', 'El enlace venció. Volvé al formulario para iniciar otra verificación.', 410);
		return $row;
	}

	// Purga al usar la API; también disponible por CLI para ejecución periódica.
	public function cleanup(): void
	{
		$this->db->execute_query("UPDATE aulify_registros_pendientes SET datos = NULL, didit_url = NULL, estado = IF(estado = 'completed', estado, 'expired') WHERE expira < ? AND datos IS NOT NULL", [time()]);
	}

	public function start(array $input, string $owner, bool $sandboxDemo = false): array
	{
		$this->ready();
		$this->cleanup();
		if ($sandboxDemo && $this->config['environment'] !== 'sandbox') {
			throw new IdentityError('SANDBOX_REQUIRED', 'La demostración solo está disponible en Sandbox.', 403);
		}
		if (!$sandboxDemo && ($input['consent'] ?? false) !== true) throw new IdentityError('CONSENT_REQUIRED', 'Debés aceptar la verificación de DNI y selfie.', 422);
		$person = [];
		foreach (['nombre', 'apellido', 'email', 'dni', 'password', 'password_confirm'] as $key) {
			if (!isset($input[$key]) || !is_string($input[$key])) throw new IdentityError('INVALID_FORM', 'Completá todos los campos.', 422);
			$person[$key] = str_starts_with($key, 'password') ? $input[$key] : trim($input[$key]);
		}
		foreach (['nombre', 'apellido'] as $key) {
			if (mb_strlen($person[$key]) < 1 || mb_strlen($person[$key]) > 100) throw new IdentityError('INVALID_FORM', 'Revisá tu nombre y apellido.', 422);
		}
		$person['email'] = strtolower($person['email']);
		if (!filter_var($person['email'], FILTER_VALIDATE_EMAIL) || strlen($person['email']) > 254
			|| !preg_match('/^[0-9]{7,8}$/', $person['dni'])) throw new IdentityError('INVALID_FORM', 'Revisá el email y el DNI argentino (7 u 8 dígitos).', 422);
		if (strlen($person['password']) < 8 || strlen($person['password']) > 72 || $person['password'] !== $person['password_confirm']) throw new IdentityError('INVALID_FORM', 'Las contraseñas deben coincidir y tener entre 8 y 72 bytes.', 422);
		if ($this->one('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [$person['email']])) throw new IdentityError('EMAIL_EXISTS', 'Ya existe una cuenta con ese email.', 409);
		$ownerHash = hash('sha256', $owner);
		$emailHash = hash('sha256', $person['email']);
		$count = $this->one('SELECT COUNT(*) AS n FROM aulify_registros_pendientes WHERE creado > ? AND (owner_hash = ? OR email_hash = ?)', [time() - 3600, $ownerHash, $emailHash]);
		if ((int) $count['n'] >= 3) throw new IdentityError('RATE_LIMIT', 'Demasiados intentos. Esperá una hora antes de iniciar otro registro.', 429);
		$person['password_hash'] = password_hash($person['password'], PASSWORD_DEFAULT);
		unset($person['password'], $person['password_confirm']);
		$ticket = bin2hex(random_bytes(32));
		$id = bin2hex(random_bytes(16));
		$this->db->execute_query('INSERT INTO aulify_registros_pendientes (id, ticket_hash, owner_hash, email_hash, datos, entorno, consentimiento, creado, expira) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
			$id, hash('sha256', $ticket), $ownerHash, $emailHash, json_encode($person, JSON_THROW_ON_ERROR), $this->config['environment'], $sandboxDemo ? 'sandbox-demo-no-personal-data' : self::CONSENT, time(), time() + 3600,
		]);
		return ['ticket' => $ticket, 'app_url' => 'aulify://verification?ticket=' . $ticket, 'environment' => $this->config['environment'], 'expires_in' => 3600];
	}

	public function startSandboxDemo(string $owner): array
	{
		if ($this->config['environment'] !== 'sandbox') {
			throw new IdentityError('SANDBOX_REQUIRED', 'La demostración solo está disponible en Sandbox.', 403);
		}

		$token = bin2hex(random_bytes(16));
		$password = bin2hex(random_bytes(24));
		return $this->start([
			'nombre' => 'María',
			'apellido' => 'Pérez',
			'email' => 'demo-' . $token . '@example.invalid',
			'dni' => '12345678',
			'password' => $password,
			'password_confirm' => $password,
		], $owner, true);
	}

	public function context(string $ticket): array
	{
		$row = $this->ticket($ticket);
		$person = json_decode($row['datos'] ?? '{}', true);
		return ['state' => $row['estado'], 'started' => $row['didit_session_id'] !== null, 'environment' => $row['entorno'], 'account' => isset($person['email']) ? [
			'name' => $person['nombre'] . ' ' . $person['apellido'], 'email' => $person['email'], 'dni_ending' => substr($person['dni'], -4),
		] : null];
	}

	public function launch(string $ticket, bool $consent, bool $phone, bool $app): array
	{
		$this->ready();
		if (!$phone) throw new IdentityError('MOBILE_REQUIRED', 'Abrí la verificación desde tu teléfono.', 403);
		if (!$consent && $this->config['environment'] !== 'sandbox') throw new IdentityError('CONSENT_REQUIRED', 'Confirmá que los datos son tuyos y aceptá la verificación.', 422);
		// Serializa también el límite global para no crear cargos simultáneos ilimitados.
		$lock = $this->one("SELECT GET_LOCK('aulify_didit_launch', 3) AS acquired");
		if ((int) $lock['acquired'] !== 1) throw new IdentityError('BUSY', 'Hay otra solicitud en curso. Intentá de nuevo.', 429);
		$this->db->begin_transaction();
		try {
			$row = $this->ticket($ticket, true);
			if ($row['didit_url'] && in_array($row['estado'], ['pending', 'in_review'], true)) {
				$this->db->commit();
				return ['url' => $row['didit_url']];
			}
			if ($row['estado'] !== 'pending' || $row['entorno'] !== $this->config['environment']) throw new IdentityError('CLOSED_ATTEMPT', 'Este intento ya no está disponible. Iniciá otro desde el formulario.', 409);
			$count = $this->one('SELECT COUNT(*) AS n FROM aulify_registros_pendientes WHERE creado > ? AND didit_session_id IS NOT NULL', [time() - 3600]);
			if ((int) $count['n'] >= max(1, (int) $this->config['max_sessions_per_hour'])) throw new IdentityError('SESSION_LIMIT', 'Se alcanzó el límite temporal de verificaciones. Intentá más tarde.', 429);
			$callback = $app ? 'aulify://verification?ticket=' . $ticket : rtrim($this->config['public_base_url'], '/') . '/Frontend/verificacion.html';
			$payload = [
				'workflow_id' => $this->config['workflow_id'], 'vendor_data' => $row['id'],
				'callback' => $callback, 'callback_method' => 'both', 'language' => 'es',
				'expected_details' => ['id_country' => 'ARG', 'expected_document_types' => ['ID']],
			];
			// Evita que una clave Live inicie verificaciones al configurar Sandbox localmente.
			if ($this->config['environment'] === 'sandbox') $payload['sandbox_scenario'] = 'approve';
			$result = ($this->provider)('POST', 'session/', $payload);
			$url = $result['url'] ?? '';
			$parts = is_string($url) ? parse_url($url) : false;
			if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || ($parts['host'] ?? '') !== 'verify.didit.me'
				|| isset($parts['user']) || isset($parts['port']) || !preg_match('~^/(?:es/)?session/[A-Za-z0-9_-]+$~', $parts['path'] ?? '')
				|| !preg_match('/^[a-f0-9-]{36}$/i', (string) ($result['session_id'] ?? ''))
				|| ($result['vendor_data'] ?? '') !== $row['id'] || ($result['workflow_id'] ?? '') !== $this->config['workflow_id']) {
				throw new IdentityError('DIDIT_INVALID_RESPONSE', 'No se pudo iniciar una sesión segura de verificación.', 502);
			}
			$this->db->execute_query('UPDATE aulify_registros_pendientes SET didit_session_id = ?, didit_url = ?, workflow_id = ? WHERE id = ?', [$result['session_id'], $url, $this->config['workflow_id'], $row['id']]);
			$this->db->commit();
			return ['url' => $url];
		} catch (\Throwable $error) {
			$this->db->rollback();
			throw $error;
		} finally {
			$this->db->query("SELECT RELEASE_LOCK('aulify_didit_launch')");
		}
	}

	public function status(string $ticket): array
	{
		$this->ready();
		$this->cleanup();
		$this->db->begin_transaction();
		try {
			$row = $this->ticket($ticket, true);
			if (!in_array($row['estado'], ['pending', 'in_review'], true) || !$row['didit_session_id'] || time() - (int) $row['ultima_consulta'] < 5) {
				$this->db->commit();
				return ['state' => $row['estado']];
			}
			if ($row['entorno'] !== $this->config['environment']) throw new IdentityError('CONFIG_CHANGED', 'La configuración cambió. Iniciá otra verificación.', 409);
			// Ni callback ni sesión de navegador autorizan una cuenta: solo esta consulta.
			$report = ($this->provider)('GET', 'session/' . $row['didit_session_id'] . '/decision/', null);
			$person = json_decode($row['datos'], true, 16, JSON_THROW_ON_ERROR);
			$state = Decision::evaluate($report, $row, $person);
			if ($state === 'approved') {
				$this->db->execute_query('INSERT INTO usuarios (nombre, apellido, email, password_hash, dni, fecha_usu) VALUES (?, ?, ?, ?, ?, ?)', [
					$person['nombre'], $person['apellido'], $person['email'], $person['password_hash'], $person['dni'], gmdate('Y-m-d'),
				]);
				$userId = $this->db->insert_id;
				$this->db->execute_query('INSERT INTO aulify_identidades_verificadas (usuario_id, didit_session_id, workflow_id, verificado, consentimiento) VALUES (?, ?, ?, ?, ?)', [
					$userId, $row['didit_session_id'], $row['workflow_id'], time(), $row['consentimiento'],
				]);
				$state = 'completed';
			}
			$keep = in_array($state, ['pending', 'in_review'], true);
			$this->db->execute_query('UPDATE aulify_registros_pendientes SET estado = ?, ultima_consulta = ?, datos = ?, didit_url = ? WHERE id = ?', [
				$state, time(), $keep ? $row['datos'] : null, $keep ? $row['didit_url'] : null, $row['id'],
			]);
			$this->db->commit();
			return ['state' => $state];
		} catch (\mysqli_sql_exception $error) {
			$this->db->rollback();
			if ($error->getCode() === 1062) throw new IdentityError('ACCOUNT_CONFLICT', 'La cuenta o verificación ya fue utilizada. Intentá iniciar sesión.', 409);
			throw $error;
		} catch (\Throwable $error) {
			$this->db->rollback();
			throw $error;
		}
	}

	public function cancel(string $ticket): array
	{
		$row = $this->ticket($ticket);
		$this->db->execute_query("UPDATE aulify_registros_pendientes SET estado = 'cancelled', datos = NULL, didit_url = NULL WHERE id = ? AND estado IN ('pending', 'in_review')", [$row['id']]);
		return ['state' => $this->ticket($ticket)['estado']];
	}
}
