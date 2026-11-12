<?php
declare(strict_types=1);
function aulifyBookingNow(): DateTimeImmutable { return new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')); }
function aulifyBookingView(array $row, int $user): array {
    $now = aulifyBookingNow();
    $start = new DateTimeImmutable($row['inicio'], $now->getTimezone());
    $end = new DateTimeImmutable($row['fin'], $now->getTimezone());
    $row['es_profesor'] = (int) $row['profesor_id'] === $user;
    $row['estado_vista'] = $row['estado'];
    if (in_array($row['estado'], ['pendiente', 'aceptada', 'confirmada'], true) && $start <= $now) $row['estado_vista'] = 'vencida';
    $row['puede_finalizar'] = !$row['es_profesor'] && $row['estado'] === 'pagada';
    $row['puede_cancelar'] = $start > $now && in_array($row['estado'], ['pendiente', 'aceptada', 'confirmada', 'pagada'], true);
    $row['devolucion_porcentaje'] = $row['es_profesor'] || $start->getTimestamp() - $now->getTimestamp() >= 48 * 3600 ? 100 : 50;
    $row['chat_activo'] = (bool) $row['permite_chat'] && $row['estado_vista'] === 'pagada';
    return $row;
}
$bookingSelect = "SELECT r.*,c.materia,CONCAT(p.nombre,' ',p.apellido) profesor,CONCAT(a.nombre,' ',a.apellido) alumno FROM aulify_reservas r JOIN aulify_clases c ON c.id=r.clase_id JOIN usuarios p ON p.id=r.profesor_id JOIN usuarios a ON a.id=r.alumno_id";
