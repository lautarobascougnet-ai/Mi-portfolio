<?php
// No permitir que la ruta histórica saltee la verificación de identidad.
http_response_code(403);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(['error' => 'Usá el registro con verificación de identidad.', 'code' => 'IDENTITY_REQUIRED'], JSON_UNESCAPED_UNICODE);
