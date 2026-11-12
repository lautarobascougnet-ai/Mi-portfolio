<?php
session_start();
require __DIR__ . '/../base de datos/conexion.php';

$error = '';
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        $error = 'Introduce un email válido y tu contraseña.';
    } else {
        $consulta = $conexion->prepare('SELECT id, nombre, password_hash FROM usuarios WHERE email = ? LIMIT 1');
        $consulta->bind_param('s', $email);
        $consulta->execute();
        $usuario = $consulta->get_result()->fetch_assoc();

        if ($usuario && password_verify($password, $usuario['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['usuario_nombre'] = $usuario['nombre'];
            header('Location: ../../Frontend/home.html');
            exit;
        }

        $error = 'El email o la contraseña no son correctos.';
    }
}
?>

