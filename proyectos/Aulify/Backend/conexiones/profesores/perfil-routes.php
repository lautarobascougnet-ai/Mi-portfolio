<?php
declare(strict_types=1);
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
require_once __DIR__ . '/perfil.php';

$app->post('/user/profile', function (Request $request, Response $response) use ($conexion, $json, $authenticatedUserId): Response {
    $userId = $authenticatedUserId();
    if ($userId === 0) {
        return $json($response, ['error' => 'Debes iniciar sesión.'], 401);
    }

    $data = (array) ($request->getParsedBody() ?? []);
    $current = $conexion->prepare('SELECT nombre, apellido, email, username, foto_perfil, rating, experiencia, titulos, descripcion, fotos_experiencia FROM usuarios WHERE id = ? LIMIT 1');
    if (!$current) {
        return $json($response, ['error' => 'No se pudo preparar la consulta del perfil.'], 500);
    }
    $current->bind_param('i', $userId);
    if (!$current->execute()) {
        return $json($response, ['error' => 'No se pudo leer el perfil.'], 500);
    }
    $saved = $current->get_result()->fetch_assoc();
    if (!$saved) {
        return $json($response, ['error' => 'Usuario no encontrado.'], 404);
    }

    $isProfessor = aulifyProfile($conexion, $userId)['is_professor'];
    if (array_key_exists('rating', $data) || array_key_exists('rol', $data) || array_key_exists('is_professor', $data)) return $json($response, ['error' => 'No podés cambiar tu rol ni tu propia calificación.'], 403);
    if (!$isProfessor && array_intersect(array_keys($data), ['experiencia', 'titulos', 'descripcion', 'experience_photos'])) return $json($response, ['error' => 'Estos campos son exclusivos del perfil de profesor aprobado.'], 403);
    $nombre = is_string($data['nombre'] ?? null) ? trim($data['nombre']) : $saved['nombre'];
    $apellido = is_string($data['apellido'] ?? null) ? trim($data['apellido']) : $saved['apellido'];
    if (mb_strlen($nombre) < 1 || mb_strlen($nombre) > 100 || mb_strlen($apellido) < 1 || mb_strlen($apellido) > 100) return $json($response, ['error' => 'Nombre y apellido deben tener entre 1 y 100 caracteres.'], 422);
    // El editor de perfil no cambia el identificador con el que se inicia sesión.
    $username = $saved['username'];
    $photo = (string) ($data['photo'] ?? '');
    $email = trim((string) ($data['email'] ?? '')) ?: $saved['email'];
    $rating = $saved['rating'];
    $experiencia = trim((string) ($data['experiencia'] ?? '')) ?: (string) ($saved['experiencia'] ?? '');
    $titulos = trim((string) ($data['titulos'] ?? '')) ?: (string) ($saved['titulos'] ?? '');
    $descripcion = trim((string) ($data['descripcion'] ?? '')) ?: (string) ($saved['descripcion'] ?? '');
    $savedPhotos = (string) ($saved['fotos_experiencia'] ?? '');
    $experiencePhotos = (array) ($data['experience_photos'] ?? []);
    foreach (['experiencia', 'titulos', 'descripcion'] as $key) {
        if (array_key_exists($key, $data)) {
            if (!is_string($data[$key]) || mb_strlen($data[$key]) > 4000) return $json($response, ['error' => 'El texto profesional debe tener hasta 4000 caracteres.'], 422);
            $$key = trim($data[$key]);
        }
    }
    if (count($experiencePhotos) > 5) return $json($response, ['error' => 'Podés adjuntar hasta cinco fotos por envío.'], 422);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return $json($response, ['error' => 'Introduce un email válido.'], 422);
    }
    if ($rating !== null && $rating !== '' && (!is_numeric($rating) || (float) $rating < 0 || (float) $rating > 5)) {
        return $json($response, ['error' => 'La calificación debe estar entre 0 y 5.'], 422);
    }
    $rating = $rating === '' || $rating === null ? null : (float) $rating;
    if ($username !== null && !preg_match('/^[\p{L}\p{N}_ ]{3,50}$/u', $username)) {
        return $json($response, ['error' => 'El nombre debe tener entre 3 y 50 caracteres y puede incluir espacios.'], 422);
    }

    if ($username !== null) {
        $check = $conexion->prepare('SELECT id FROM usuarios WHERE username = ? AND id <> ? LIMIT 1');
        $check->bind_param('si', $username, $userId);
        $check->execute();
        if ($check->get_result()->num_rows > 0) {
            return $json($response, ['error' => 'Ese nombre de usuario ya está ocupado.'], 409);
        }
    }

    $emailCheck = $conexion->prepare('SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1');
    $emailCheck->bind_param('si', $email, $userId);
    $emailCheck->execute();
    if ($emailCheck->get_result()->num_rows > 0) {
        return $json($response, ['error' => 'Ese email ya está ocupado.'], 409);
    }

    $photoPath = null;
    if ($photo !== '') {
        if (!preg_match('/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/', $photo, $matches)) {
            return $json($response, ['error' => 'La foto debe ser JPG, PNG o WebP.'], 422);
        }
        $photoData = base64_decode($matches[2], true);
        if ($photoData === false || strlen($photoData) > 2 * 1024 * 1024) {
            return $json($response, ['error' => 'La foto no puede superar los 2 MB.'], 422);
        }
        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $directory = __DIR__ . '/../uploads/perfiles';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            return $json($response, ['error' => 'No se pudo guardar la foto.'], 500);
        }
        $filename = $userId . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        if (!file_put_contents($directory . '/' . $filename, $photoData)) {
            return $json($response, ['error' => 'No se pudo guardar la foto.'], 500);
        }
        $photoPath = 'Backend/conexiones/uploads/perfiles/' . $filename;
    }

    $photoPath = $photoPath ?? $saved['foto_perfil'];
    $storedExperiencePhotos = $savedPhotos;
    if ($experiencePhotos !== []) {
        $newPaths = [];
        $directory = __DIR__ . '/../uploads/perfiles';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            return $json($response, ['error' => 'No se pudo preparar la carpeta de fotos.'], 500);
        }
        foreach ($experiencePhotos as $experiencePhoto) {
            if (!is_string($experiencePhoto) || !preg_match('/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/', $experiencePhoto, $matches)) {
                return $json($response, ['error' => 'Las fotos deben ser JPG, PNG o WebP.'], 422);
            }
            $photoData = base64_decode($matches[2], true);
            if ($photoData === false || strlen($photoData) > 2 * 1024 * 1024) {
                return $json($response, ['error' => 'Cada foto no puede superar los 2 MB.'], 422);
            }
            $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
            $filename = $userId . '_experiencia_' . bin2hex(random_bytes(8)) . '.' . $extension;
            if (!file_put_contents($directory . '/' . $filename, $photoData)) {
                return $json($response, ['error' => 'No se pudo guardar una foto.'], 500);
            }
            $newPaths[] = 'Backend/conexiones/uploads/perfiles/' . $filename;
        }
        $storedExperiencePhotos = json_encode($newPaths, JSON_UNESCAPED_SLASHES);
    }

    $update = $conexion->prepare('UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, username = ?, foto_perfil = ?, rating = ?, experiencia = ?, titulos = ?, descripcion = ?, fotos_experiencia = ? WHERE id = ?');
    if (!$update) {
        return $json($response, ['error' => 'No se pudo preparar el guardado del perfil.'], 500);
    }
    $update->bind_param('sssssdssssi', $nombre, $apellido, $email, $username, $photoPath, $rating, $experiencia, $titulos, $descripcion, $storedExperiencePhotos, $userId);
    if (!$update->execute()) {
        return $json($response, ['error' => 'No se pudo actualizar el perfil.'], 500);
    }

    $refresh = $conexion->prepare('SELECT id, nombre, apellido, email, username, foto_perfil, rating, experiencia, titulos, descripcion, fotos_experiencia FROM usuarios WHERE id = ? LIMIT 1');
    $refresh->bind_param('i', $userId);
    $refresh->execute();
    $updatedUser = $refresh->get_result()->fetch_assoc();
    return $json($response, [
        'message' => 'Perfil actualizado.',
        'user' => aulifyProfile($conexion, $userId),
    ]);
});
