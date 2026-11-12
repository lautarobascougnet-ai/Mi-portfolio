<?php
declare(strict_types=1);

// Turnos de una hora, hora local de Buenos Aires. No implica cobro ni videollamada.
function aulifyBookingDate(string $date): ?DateTimeImmutable {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) return null;
    $zone = new DateTimeZone('America/Argentina/Buenos_Aires');
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone);
    $today = new DateTimeImmutable('today', $zone);
    return $parsed && $parsed->format('Y-m-d') === $date && $parsed >= $today && $parsed <= $today->modify('+1 year') ? $parsed : null;
}
function aulifyClassSlots(?string $json, string $date): array {
    $day = aulifyBookingDate($date);
    if (!$day || !$json) return [];
    $schedule = json_decode($json, true);
    if (!is_array($schedule)) return [];
    $ranges = $schedule['exceptions'][$date] ?? $schedule['weekly'][$day->format('N')] ?? [];
    $slots = [];
    foreach ($ranges as $range) {
        $start = $day->modify($range['start']);
        $end = $range['end'] === '24:00' ? $day->modify('+1 day') : $day->modify($range['end']);
        for ($cursor = $start; $cursor->modify('+1 hour') <= $end; $cursor = $cursor->modify('+1 hour')) {
            if ($cursor <= new DateTimeImmutable('now', $day->getTimezone())) continue;
            $slots[] = ['inicio' => $cursor->format('Y-m-d H:i:s'), 'fin' => $cursor->modify('+1 hour')->format('Y-m-d H:i:s'), 'hora' => $cursor->format('H:i')];
        }
    }
    return $slots;
}
function aulifyBookingConflict(mysqli $db, int $teacher, int $student, string $start, string $end): bool {
    // Un usuario no puede superponer clases, sea alumno o profesor en cada reserva.
    return (bool) $db->execute_query("SELECT id FROM aulify_reservas WHERE estado IN ('pendiente','aceptada','confirmada','pagada') AND inicio < ? AND fin > ? AND (profesor_id IN (?, ?) OR alumno_id IN (?, ?)) LIMIT 1", [$end, $start, $teacher, $student, $teacher, $student])->fetch_assoc();
}
