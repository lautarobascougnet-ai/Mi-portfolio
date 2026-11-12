# Aulify para celulares

La configuración móvil está en `porteo`, separada de Frontend y Backend.
Incluye PWA, servidor HTTPS local y APK Android de desarrollo. No se publicó
la web en Internet y no se probó la instalación en un teléfono físico.

Las instrucciones completas están en [porteo/LEEME.txt](../porteo/LEEME.txt).

## Uso local

1. Iniciar Apache y MySQL en XAMPP.
2. Ejecutar `porteo/iniciar.cmd` y mantenerlo abierto.
3. Conectar teléfono y PC al mismo router. Si hay bloqueo de red, revisar
   `porteo/habilitar-red.ps1` y ejecutarlo como administrador. El firewall no
   se configuró automáticamente.
4. Copiar `porteo/dist/Aulify-local.apk` al Android e instalarlo. El APK
   incluye la confianza del certificado local solo para el servidor configurado.

Alternativamente, para instalar la PWA desde el navegador, seguir los pasos
de certificado y HTTPS en `porteo/estado/ACCESO_TELEFONO.txt` y `porteo/LEEME.txt`.
En iPhone la opción es PWA, no APK. Si cambia la IP, regenerar configuración
y recompilar el APK mediante `porteo/compilar-apk.cmd`.

## Registro

El formulario aparece primero en computadora y celular. Encima de Registrarse
se explica la verificación de DNI, prueba de vida y comparación facial con Didit.
La integración requiere configurar y habilitar el proveedor; mientras esté
desactivado no se envían los datos del formulario.

Al habilitarla, la PC genera un QR privado para abrir el APK Android. En el
celular se continúa directamente. Didit se abre en el navegador y devuelve
al usuario a Aulify, donde PHP comprueba el resultado antes de crear la cuenta.
Una sesión sandbox nunca crea usuarios reales. La API antigua de registro
está bloqueada para impedir que se omita la verificación.

Estado al 06-10-2026: Sandbox habilitado y confirmado con Didit; se comprobó
el inicio de la verificación sin capturas ni usuarios reales. Usar solo datos
y documentos de muestra. Instrucciones en [porteo/LEEME.txt](../porteo/LEEME.txt).
La detección móvil por User-Agent no demuestra que sea un dispositivo físico.
El QR abre Android, no iPhone; desde iPhone se puede usar directamente la web.
No se probó todavía con una identidad real ni en un teléfono físico.

## Recursos y pruebas

- Manifest: `porteo/manifest.webmanifest`.
- PWA y worker: `porteo/js/pwa.js` y `porteo/js/service-worker.js`.
- Iconos y aviso sin conexión: `porteo/icons` y `porteo/offline.html`.
- QR del registro: generado localmente por `Frontend/js/vendor/qrcode.js`;
  el PNG de prueba anterior se conserva como recurso histórico, no se usa en el registro.
- HTTPS, certificados y compilación: scripts en `porteo/js`.
- Android: `porteo/android`; dependencias de compilación: `porteo/sdk`.
- Herramientas: `porteo/tools`. Instalar con `npm.cmd ci --prefix porteo/tools`.
- Pruebas: `node porteo/tools/check-registration.cjs`,
  `node porteo/tools/check-mobile.cjs`, `node porteo/tools/check-https.cjs`.
- Reglas de identidad: `php Backend/conexiones/identidad/tests.php` (tablas temporales).

El worker almacena únicamente iconos y el aviso público sin conexión; no
respuestas API, sesiones ni páginas privadas. Las funciones necesitan el
servidor y los estilos Tailwind por CDN requieren Internet.

No publicar claves de `porteo/privado`. El APK es local, no una distribución
de producción ni una app que incluya el servidor PHP/MySQL.
