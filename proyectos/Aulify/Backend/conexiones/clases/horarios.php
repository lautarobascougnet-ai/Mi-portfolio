<?php
declare(strict_types=1);

// Contrato compartido: semana recurrente y excepciones por fecha, en hora local.
function aulifyValidateSchedule(mixed $value): array {
    if (!is_array($value) || ($value['timezone'] ?? '') !== 'America/Argentina/Buenos_Aires' || !is_array($value['weekly'] ?? null) || !is_array($value['exceptions'] ?? null)) {
        throw new InvalidArgumentException('Configurá los días y horarios de la clase.');
    }
    $validateRanges = static function ($ranges): array {
        if (!is_array($ranges) || !array_is_list($ranges) || count($ranges) > 24) throw new InvalidArgumentException('Usá hasta 24 franjas por día.');
        $result = [];
        foreach ($ranges as $range) {
            $start = $range['start'] ?? null; $end = $range['end'] ?? null;
            if (!is_string($start) || !is_string($end) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) || !preg_match('/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/', $end) || $start >= $end) throw new InvalidArgumentException('Cada franja debe empezar antes de terminar, dentro del mismo día.');
            $result[] = ['start' => $start, 'end' => $end];
        }
        usort($result, static fn($a, $b) => strcmp($a['start'], $b['start']));
        $previous = null;
        foreach ($result as $range) {
            if ($previous !== null && $range['start'] < $previous) throw new InvalidArgumentException('Hay franjas horarias superpuestas.');
            $previous = $range['end'];
        }
        return $result;
    };
    $weekly = [];
    foreach ($value['weekly'] as $day => $ranges) {
        if (!in_array((string) $day, ['1','2','3','4','5','6','7'], true)) throw new InvalidArgumentException('Día semanal inválido.');
        $weekly[(string) $day] = $validateRanges($ranges);
    }
    if (count($value['exceptions']) > 366) throw new InvalidArgumentException('Usá hasta 366 fechas especiales.');
    $exceptions = [];
    $today = new DateTimeImmutable('today', new DateTimeZone('America/Argentina/Buenos_Aires'));
    foreach ($value['exceptions'] as $date => $ranges) {
        $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date, $today->getTimezone()) : false;
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $parsed < $today || $parsed > $today->modify('+1 year')) throw new InvalidArgumentException('Elegí fechas válidas desde hoy hasta un año adelante.');
        $exceptions[$date] = $validateRanges($ranges);
    }
    if (!array_filter($weekly) && !array_filter($exceptions)) throw new InvalidArgumentException('Elegí al menos un día y una franja disponible antes de publicar.');
    return ['timezone' => $value['timezone'], 'weekly' => (object) $weekly, 'exceptions' => (object) $exceptions];
}
