<?php
declare(strict_types=1);

use Aulify\Identidad\IdentityError;
use Aulify\Identidad\Registration;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

require_once __DIR__ . '/Didit.php';
require_once __DIR__ . '/Registration.php';

$identityConfig = \Aulify\Identidad\configuration();
$identity = new Registration($conexion, $identityConfig);
$app->get('/identity/config', function (Request $request, Response $response) use ($json, $identityConfig): Response {
	$_SESSION['identity_csrf'] ??= bin2hex(random_bytes(32));
	$_SESSION['identity_owner'] ??= bin2hex(random_bytes(32));
	return $json($response, [
		'enabled' => \Aulify\Identidad\isConfigured($identityConfig),
		'environment' => $identityConfig['environment'],
		'csrf' => $_SESSION['identity_csrf'],
		'consent_version' => Registration::CONSENT,
	]);
});

// Todas las operaciones requieren JSON y token CSRF además del ticket aleatorio.
foreach (['start', 'demo', 'context', 'launch', 'status', 'cancel'] as $action) {
	$app->post('/identity/' . $action, function (Request $request, Response $response) use ($json, $identity, $action): Response {
		try {
			if (strtolower(explode(';', $request->getHeaderLine('Content-Type'))[0]) !== 'application/json') throw new IdentityError('JSON_REQUIRED', 'Se requiere JSON.', 415);
			if ((int) $request->getHeaderLine('Content-Length') > 16384 || $request->getBody()->getSize() > 16384) throw new IdentityError('BODY_TOO_LARGE', 'Solicitud demasiado grande.', 413);
			$csrf = $_SESSION['identity_csrf'] ?? '';
			if ($csrf === '' || !hash_equals($csrf, $request->getHeaderLine('X-CSRF-Token'))) throw new IdentityError('CSRF', 'Recargá la página antes de continuar.', 403);
			// Apache local detrás de porteo usa HTTP internamente. El origen externo debe ser HTTPS.
			$origin = $request->getHeaderLine('Origin');
			if ($origin !== '' && !str_starts_with($origin, 'https://') && !preg_match('~^http://(localhost|127\.0\.0\.1)(:\d+)?$~', $origin)) throw new IdentityError('HTTPS_REQUIRED', 'Usá la dirección HTTPS de Aulify.', 403);
			$data = (array) ($request->getParsedBody() ?? []);
			$ticket = is_string($data['ticket'] ?? null) ? $data['ticket'] : '';
			$result = match ($action) {
				'start' => $identity->start($data, $_SESSION['identity_owner']),
				'demo' => $identity->startSandboxDemo($_SESSION['identity_owner']),
				'context' => $identity->context($ticket),
				'launch' => $identity->launch($ticket, ($data['consent'] ?? false) === true, aulifyIsPhone($request->getHeaderLine('User-Agent')), str_contains($request->getHeaderLine('User-Agent'), 'AulifyApp/')),
				'status' => $identity->status($ticket),
				'cancel' => $identity->cancel($ticket),
			};
			return $json($response, $result, $action === 'start' ? 201 : 200);
		} catch (IdentityError $error) {
			return $json($response, ['error' => $error->getMessage(), 'code' => $error->reason], $error->getCode());
		}
	});
}
