<?php

declare(strict_types=1);

// Política de registro para teléfonos. No depende del ancho de la ventana.
// El User-Agent es una señal del navegador, no una prueba de identidad física.
function aulifyIsPhone(string $userAgent): bool
{
    return preg_match('/iPhone|iPod|Windows Phone|Android.*Mobile/i', $userAgent) === 1;
}
