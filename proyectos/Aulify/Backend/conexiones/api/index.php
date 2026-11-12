<?php

declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

require __DIR__ . '/../../../vendor/autoload.php';
require __DIR__ . '/../mobile.php';
// La conexión ocurre antes del middleware: sus errores también deben ser JSON.
try {
    require __DIR__ . '/../../base de datos/conexion.php';
} catch (mysqli_sql_exception $error) {
    error_log('Aulify: conexión a MySQL fallida (código ' . $error->getCode() . ').');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => 'La base de datos no está disponible. Revisá que MySQL esté iniciado en XAMPP.', 'code' => 'DATABASE_UNAVAILABLE'], JSON_UNESCAPED_UNICODE);
    exit;
}

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

$app = AppFactory::create();
$app->setBasePath(rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/'));
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

$app->add(function (Request $request, $handler): Response {
    $response = $handler->handle($request);

    return $response
        ->withHeader('Cache-Control', 'no-store')
        ->withHeader('Content-Type', 'application/json; charset=utf-8');
});

$app->options('/{routes:.*}', function (Request $request, Response $response): Response {
    return $response;
});

$json = static function (Response $response, array $data, int $status = 200): Response {
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
    return $response->withStatus($status);
};

$authenticatedUserId = static function (): int {
    return (int) ($_SESSION['usuario_id'] ?? 0);
};

// Índice JSON de la API: al abrir este directorio en el navegador no se
// renderiza frontend ni se muestra una excepción de Slim.
$app->get('/', function (Request $request, Response $response) use ($json): Response {
    return $json($response, [
        'name' => 'Aulify API',
        'version' => '1.0',
        'format' => 'JSON',
        'endpoints' => [
            ['method' => 'GET', 'path' => '/identity/config', 'description' => 'Disponibilidad y protección CSRF.'],
            ['method' => 'POST', 'path' => '/identity/start', 'description' => 'Prepara un registro pendiente; no crea una cuenta.'],
            ['method' => 'POST', 'path' => '/identity/demo', 'description' => 'Prepara un intento ficticio solo en Sandbox; nunca crea una cuenta.'],
            ['method' => 'POST', 'path' => '/identity/context', 'description' => 'Confirma los datos del intento mediante ticket.'],
            ['method' => 'POST', 'path' => '/identity/launch', 'description' => 'Abre Didit desde el teléfono.'],
            ['method' => 'POST', 'path' => '/identity/status', 'description' => 'Consulta Didit y completa solo registros verificados.'],
            ['method' => 'POST', 'path' => '/identity/cancel', 'description' => 'Cancela el intento y elimina sus datos pendientes.'],
            ['method' => 'POST', 'path' => '/auth/register', 'description' => 'Deshabilitado: usar el flujo de identidad.'],
            ['method' => 'GET', 'path' => '/classes', 'description' => 'Catálogo público de clases publicadas.'],
            ['method' => 'GET', 'path' => '/classes/detail', 'description' => 'Detalle de una clase por id.'],
            ['method' => 'GET', 'path' => '/classes/availability', 'description' => 'Horarios de una hora por id/date. Requiere sesión.'],
            ['method' => 'GET', 'path' => '/teachers/profile', 'description' => 'Perfil profesional público por id.'],
            ['method' => 'POST', 'path' => '/classes/update', 'description' => 'Editar clase y horarios propios con CSRF.'],
            ['method' => 'POST', 'path' => '/bookings', 'description' => 'Confirmar reserva con CSRF y sin superposiciones.'],
            ['method' => 'POST', 'path' => '/bookings/cancel', 'description' => 'Cancelar reserva propia con CSRF.'],
            ['method' => 'GET', 'path' => '/classes/mine', 'description' => 'Clases propias, permiso docente y CSRF. Requiere sesión.'],
            ['method' => 'POST', 'path' => '/classes', 'description' => 'Publica una clase. Solo profesores aprobados con CSRF.'],
            ['method' => 'POST', 'path' => '/auth/login', 'description' => 'Inicia sesión.'],
            ['method' => 'GET', 'path' => '/auth/me', 'description' => 'Devuelve el usuario de la sesión actual.'],
            ['method' => 'POST', 'path' => '/auth/logout', 'description' => 'Cierra la sesión actual.'],
            ['method' => 'POST', 'path' => '/user/profile', 'description' => 'Actualiza el perfil autenticado.'],
            ['method' => 'POST', 'path' => '/user/password', 'description' => 'Cambia la contraseña del usuario autenticado.'],
            ['method' => 'POST', 'path' => '/user/delete', 'description' => 'Elimina la cuenta autenticada.'],
            ['method' => 'GET', 'path' => '/teacher/application', 'description' => 'Consulta la solicitud propia para ser profesor y emite CSRF.'],
            ['method' => 'POST', 'path' => '/teacher/application', 'description' => 'Guarda el formulario y título opcional como solicitud pendiente.'],
            ['method' => 'GET', 'path' => '/admin/session', 'description' => 'Estado del acceso administrativo y token CSRF.'],
            ['method' => 'POST', 'path' => '/admin/login', 'description' => 'Acceso exclusivo del administrador.'],
            ['method' => 'POST', 'path' => '/admin/logout', 'description' => 'Cierra el acceso administrativo.'],
            ['method' => 'GET', 'path' => '/admin/teachers', 'description' => 'Solicitudes paginadas; requiere acceso administrativo.'],
            ['method' => 'GET', 'path' => '/admin/teacher-title', 'description' => 'Título privado; requiere acceso administrativo.'],
            ['method' => 'POST', 'path' => '/admin/teacher-review', 'description' => 'Acepta o rechaza una solicitud pendiente.'],
        ],
    ]);
});

$app->post('/auth/register', function (Request $request, Response $response) use ($json): Response {
    return $json($response, ['error' => 'Completá la verificación de identidad para crear tu cuenta.', 'code' => 'IDENTITY_REQUIRED'], 403);
});

require __DIR__ . '/../identidad/routes.php';
require __DIR__ . '/../profesores/routes.php';
require __DIR__ . '/../profesores/admin.php';
require __DIR__ . '/../profesores/materias.php';
require __DIR__ . '/../clases/routes.php';
require __DIR__ . '/../clases/reservas-routes.php';
require __DIR__ . '/../apuntes/routes.php';
require_once __DIR__ . '/../profesores/perfil.php';

$app->post('/auth/login', function (Request $request, Response $response) use ($conexion, $json): Response {
    $data = (array) ($request->getParsedBody() ?? []);
    $email = trim((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($email === '' || strlen($email) > 255 || $password === '') {
        return $json($response, ['error' => 'Introduce tu email o usuario y tu contraseña.'], 422);
    }

    // La cuenta de prueba se autentica igual que las demás: nunca hay contraseña maestra.
    // Se elige una columna fija para evitar ambigüedad entre emails y nombres de usuario.
    if ($email === 'admin') {
        // Alias estable de la misma cuenta autorizada en el panel, aunque cambie su username.
        // Solo inicia la sesión de usuario; el panel conserva su autenticación independiente.
        $user = $conexion->query('SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash FROM aulify_administradores a JOIN usuarios u ON u.id=a.usuario_id ORDER BY u.id LIMIT 1')->fetch_assoc();
    } else {
        $column = filter_var($email, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $query = $conexion->prepare("SELECT id, nombre, apellido, email, password_hash FROM usuarios WHERE $column = ? LIMIT 1");
        $query->bind_param('s', $email);
        $query->execute();
        $user = $query->get_result()->fetch_assoc();
    }

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return $json($response, ['error' => 'El email, usuario o contraseña no son correctos.'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $user['id'];
    $_SESSION['usuario_nombre'] = $user['nombre'];
    $_SESSION['usuario_apellido'] = $user['apellido'];
    $_SESSION['usuario_email'] = $user['email'];
    unset($user['password_hash']);

    return $json($response, ['user' => $user]);
});

$app->get('/auth/me', function (Request $request, Response $response) use ($conexion, $json): Response {
    if (empty($_SESSION['usuario_id'])) {
        return $json($response, ['error' => 'No hay una sesión activa.'], 401);
    }

    $query = $conexion->prepare('SELECT id, nombre, apellido, email, username, foto_perfil, rating, experiencia, titulos, descripcion, fotos_experiencia FROM usuarios WHERE id = ? LIMIT 1');
    if (!$query) {
        return $json($response, ['error' => 'No se pudo preparar la consulta del perfil.'], 500);
    }
    $query->bind_param('i', $_SESSION['usuario_id']);
    if (!$query->execute()) {
        return $json($response, ['error' => 'No se pudo cargar el perfil.'], 500);
    }
    $user = $query->get_result()->fetch_assoc();

    return $user ? $json($response, ['user' => aulifyProfile($conexion, (int) $user['id'])]) : $json($response, ['error' => 'Usuario no encontrado.'], 404);
});

require __DIR__ . '/../profesores/perfil-routes.php';

$app->post('/user/password', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
    $userId = $authenticatedUserId();
    $data = (array) ($request->getParsedBody() ?? []);
    $currentPassword = (string) ($data['current_password'] ?? '');
    $newPassword = (string) ($data['new_password'] ?? '');
    $confirmPassword = (string) ($data['confirm_password'] ?? '');
    if ($userId === 0) return $json($response, ['error' => 'Debes iniciar sesión.'], 401);
    $query = $conexion->prepare('SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1');
    $query->bind_param('i', $userId);
    $query->execute();
    $user = $query->get_result()->fetch_assoc();
    if (!$user || !password_verify($currentPassword, $user['password_hash'])) return $json($response, ['error' => 'La contraseña actual no es correcta.'], 422);
    if (strlen($newPassword) < 8 || $newPassword !== $confirmPassword) return $json($response, ['error' => 'La nueva contraseña debe tener 8 caracteres y coincidir.'], 422);
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $conexion->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?');
    $update->bind_param('si', $hash, $userId);
    $update->execute();
    return $json($response, ['message' => 'Contraseña actualizada.']);
});

$app->post('/user/delete', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
    $userId = $authenticatedUserId();
    if ($userId === 0) return $json($response, ['error' => 'Debes iniciar sesión.'], 401);
    $data = (array) ($request->getParsedBody() ?? []);
    $password = (string) ($data['password'] ?? '');
    $query = $conexion->prepare('SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1');
    $query->bind_param('i', $userId);
    $query->execute();
    $user = $query->get_result()->fetch_assoc();
    if (!$user || !password_verify($password, $user['password_hash'])) return $json($response, ['error' => 'La contraseña no es correcta.'], 422);
    $delete = $conexion->prepare('DELETE FROM usuarios WHERE id = ?');
    $delete->bind_param('i', $userId);
    $delete->execute();
    $_SESSION = [];
    session_destroy();
    return $json($response, ['message' => 'Cuenta eliminada.']);
});

$app->post('/auth/logout', function (Request $request, Response $response) use ($json): Response {
    // Invalida tanto los datos de PHP como la cookie que identifica la sesión.
    $_SESSION = [];
    session_unset();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();

    return $json($response, ['message' => 'Sesión cerrada.']);
});

// Las rutas inválidas y los métodos no permitidos también responden JSON,
// evitando que Slim muestre páginas de error HTML o trazas de PHP.
$errorMiddleware = $app->addErrorMiddleware(false, false, false);
$errorMiddleware->setDefaultErrorHandler(function (
    Request $request,
    Throwable $exception,
    bool $displayErrorDetails,
    bool $logErrors,
    bool $logErrorDetails
) use ($app): Response {
    $status = $exception instanceof \Slim\Exception\HttpException
        ? $exception->getCode()
        : 500;
    $status = $status >= 400 && $status < 600 ? $status : 500;

    $response = $app->getResponseFactory()->createResponse($status);
    $response->getBody()->write(json_encode([
        'error' => $status === 405 ? 'Método HTTP no permitido.' : 'No se pudo procesar la solicitud.',
        'status' => $status,
    ], JSON_UNESCAPED_UNICODE));

    return $response
        ->withHeader('Content-Type', 'application/json; charset=utf-8')
        ->withHeader('Cache-Control', 'no-store');
});

$app->run();
