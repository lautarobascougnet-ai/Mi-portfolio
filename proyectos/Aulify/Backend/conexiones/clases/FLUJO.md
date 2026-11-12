# Reservas y pagos de prueba

Instalación aditiva: `C:\xampp\php\php.exe Backend/conexiones/clases/instalar.php`.

- La clase ofrece virtual, presencial o ambas. El alumno elige una modalidad al solicitar la reserva.
- El horario queda ocupado durante la solicitud pendiente. El profesor acepta o rechaza; únicamente el alumno puede simular el pago de una reserva aceptada antes del inicio.
- QR, transferencia y efectivo generan una referencia `SIM-...`. No existe integración bancaria, cobro ni devolución real. El comprobante se consulta únicamente desde la reserva privada.
- El inicio del alumno muestra reservas aceptadas pendientes de pago y se actualiza cada 10 segundos. Mis clases se actualiza cada 15 segundos.
- A partir del fin del horario, una reserva paga se muestra como terminada. Las solicitudes sin pagar vencen al inicio.
- El alumno puede cancelar antes del inicio: devolución simulada del 100 % con 48 horas o más; 50 % con menos de 48 horas. Si cancela el profesor, la devolución simulada es completa. No se cancela después del inicio.
- El permiso de chat se copia de la clase al solicitar la reserva. Editar la clase afecta futuras reservas. Solo los participantes acceden al chat, después del pago y hasta el fin o cancelación. Los mensajes usan texto plano y se actualizan cada 5 segundos.
- Las reservas antiguas confirmadas siguen aceptadas y pendientes de pago simulado; se conserva su modalidad.

Pruebas de servidor aisladas en tablas temporales: `php Backend/conexiones/clases/flujo-tests.php` y `php Backend/conexiones/clases/reservas-tests.php`.
Prueba de navegador con datos simulados: `node porteo/tools/check-reservation-flow.cjs`.
