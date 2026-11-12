<?php
// Copiar a config.local.php. Nunca guardar claves en HTML, JS, APK ni Git.
return [
	'enabled' => false,
	'api_key' => '',
	'workflow_id' => '',
	// Empezar con una aplicación sandbox de Didit. No crea usuarios reales.
	'environment' => 'sandbox',
	// URL de la raíz de Aulify, sin barra final. Vacío usa la IP de porteo.
	'public_base_url' => '',
	// Límite local de sesiones externas nuevas por hora (control de gastos).
	'max_sessions_per_hour' => 20,
];
