<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
// Ejecutar solo después de configurar un transporte real en PHP/sendmail.
// No se inventan credenciales ni se envía desde el correo de soporte del footer.
$sender = getenv('AULIFY_MAIL_FROM');
if (getenv('AULIFY_MAIL_ENABLED') !== '1' || !filter_var($sender,FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/',$sender)) {
    fwrite(STDERR,"Envío desactivado. Configurá el transporte de correo, AULIFY_MAIL_FROM y AULIFY_MAIL_ENABLED=1.\n"); exit(1);
}
require __DIR__ . '/../../base de datos/conexion.php';
if (!$conexion->query("SELECT GET_LOCK('aulify_mail_worker',0) ok")->fetch_assoc()['ok']) exit;
try {
    $rows = $conexion->query("SELECT * FROM aulify_correos WHERE estado='pendiente' ORDER BY id LIMIT 50")->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as $row) {
        if (!filter_var($row['destinatario'],FILTER_VALIDATE_EMAIL)) continue;
        // 'Aceptado' significa aceptado por el transporte, no entrega confirmada.
        if (mail($row['destinatario'], '=?UTF-8?B?'.base64_encode($row['asunto']).'?=', $row['cuerpo'], ['From'=>$sender,'MIME-Version'=>'1.0','Content-Type'=>'text/plain; charset=UTF-8'])) {
            $conexion->execute_query("UPDATE aulify_correos SET estado='aceptado',enviado_en=UTC_TIMESTAMP() WHERE id=?",[$row['id']]);
        }
    }
} finally { $conexion->query("SELECT RELEASE_LOCK('aulify_mail_worker')"); }
