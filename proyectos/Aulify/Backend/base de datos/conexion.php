<?php

$conexion = new mysqli('127.0.0.1', 'root', '', 'aulifyb');

if ($conexion->connect_errno) {
    http_response_code(500);
    exit('No se pudo conectar con la base de datos.');
}

$conexion->set_charset('utf8mb4');
