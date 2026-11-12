<?php
declare(strict_types=1);

// El rol visible procede de una aprobación del servidor, no del formulario.
function aulifyProfile(mysqli $db, int $id): ?array {
	$user = $db->execute_query("SELECT u.id, u.nombre, u.apellido, u.email, u.username, u.foto_perfil, u.rating, u.experiencia, u.titulos, u.descripcion, u.fotos_experiencia, EXISTS(SELECT 1 FROM solicitudes_profesor s WHERE s.usuario_id=u.id AND s.estado='aprobada') AS is_professor FROM usuarios u WHERE u.id=?", [$id])->fetch_assoc();
	if (!$user) return null;
	$user['is_professor'] = (bool) $user['is_professor'];
	$user['tipo'] = $user['is_professor'] ? 'Profesor' : 'Alumno';
	if (!$user['is_professor']) foreach (['experiencia', 'titulos', 'descripcion', 'fotos_experiencia'] as $field) unset($user[$field]);
	return $user;
}
