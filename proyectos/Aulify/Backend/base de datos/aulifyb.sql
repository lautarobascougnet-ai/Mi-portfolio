-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 13-10-2026 a las 23:25:19
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `aulifyb`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `apuntes`
--

CREATE TABLE `apuntes` (
  `id_apuntes` bigint(20) NOT NULL,
  `nom_apuntes` varchar(255) DEFAULT NULL,
  `archivo_apuntes` varchar(255) DEFAULT NULL,
  `fecha_apuntes` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_administradores`
--

CREATE TABLE `aulify_administradores` (
  `usuario_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `aulify_administradores`
--

INSERT INTO `aulify_administradores` (`usuario_id`) VALUES
(9);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_apuntes`
--

CREATE TABLE `aulify_apuntes` (
  `id` bigint(20) NOT NULL,
  `usuario_id` bigint(20) NOT NULL,
  `carpeta_id` bigint(20) DEFAULT NULL,
  `nombre` text NOT NULL,
  `descripcion` longtext NOT NULL,
  `contenido` longtext NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `actualizado` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `aulify_apuntes`
--

INSERT INTO `aulify_apuntes` (`id`, `usuario_id`, `carpeta_id`, `nombre`, `descripcion`, `contenido`, `version`, `actualizado`) VALUES
(2, 9, 1, 'a', 'a', 'as', 1, '2026-10-12 20:37:37');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_carpetas`
--

CREATE TABLE `aulify_carpetas` (
  `id` bigint(20) NOT NULL,
  `usuario_id` bigint(20) NOT NULL,
  `nombre` text NOT NULL,
  `descripcion` longtext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `aulify_carpetas`
--

INSERT INTO `aulify_carpetas` (`id`, `usuario_id`, `nombre`, `descripcion`) VALUES
(1, 9, 'Matematica', '1ro Uni\n');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_clases`
--

CREATE TABLE `aulify_clases` (
  `id` bigint(20) NOT NULL,
  `profesor_id` bigint(20) NOT NULL,
  `materia` varchar(100) NOT NULL,
  `descripcion` text NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `modalidad` varchar(20) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `horarios` mediumtext DEFAULT NULL,
  `permite_chat` tinyint(4) NOT NULL DEFAULT 0,
  `moneda` char(3) NOT NULL DEFAULT 'EUR'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `aulify_clases`
--

INSERT INTO `aulify_clases` (`id`, `profesor_id`, `materia`, `descripcion`, `precio`, `modalidad`, `creado_en`, `horarios`, `permite_chat`, `moneda`) VALUES
(4, 9, 'Matematica', 'Descripcion elegida por el profesor para vender su servicio', 15.00, 'ambas', '2026-10-13 20:06:06', '{\"timezone\":\"America\\/Argentina\\/Buenos_Aires\",\"weekly\":{\"1\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"2\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"3\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"4\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"5\":[{\"start\":\"09:00\",\"end\":\"17:00\"}]},\"exceptions\":{}}', 0, 'EUR');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_correos`
--

CREATE TABLE `aulify_correos` (
  `id` bigint(20) NOT NULL,
  `evento` varchar(100) NOT NULL,
  `destinatario` varchar(254) NOT NULL,
  `asunto` varchar(200) NOT NULL,
  `cuerpo` text NOT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `enviado_en` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_identidades_verificadas`
--

CREATE TABLE `aulify_identidades_verificadas` (
  `usuario_id` bigint(20) NOT NULL,
  `didit_session_id` char(36) NOT NULL,
  `workflow_id` char(36) NOT NULL,
  `verificado` bigint(20) NOT NULL,
  `consentimiento` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_materias`
--

CREATE TABLE `aulify_materias` (
  `id` bigint(20) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `solicitado_por` bigint(20) DEFAULT NULL,
  `revisado_por` bigint(20) DEFAULT NULL,
  `motivo` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `revisado_en` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `aulify_materias`
--

INSERT INTO `aulify_materias` (`id`, `nombre`, `estado`, `solicitado_por`, `revisado_por`, `motivo`, `creado_en`, `revisado_en`) VALUES
(1, 'Matemáticas', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(2, 'Inglés', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(3, 'Dibujo', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(4, 'Derecho', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(5, 'Francés', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(6, 'Programación', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(7, 'Biología', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(8, 'Historia', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(9, 'Economía', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(10, 'Clash Royale', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(11, 'hola', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL),
(12, 'Matematica', 'aprobada', NULL, NULL, NULL, '2026-10-13 18:59:42', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_registros_pendientes`
--

CREATE TABLE `aulify_registros_pendientes` (
  `id` char(32) NOT NULL,
  `ticket_hash` char(64) NOT NULL,
  `owner_hash` char(64) NOT NULL,
  `email_hash` char(64) NOT NULL,
  `datos` mediumtext DEFAULT NULL,
  `estado` varchar(32) NOT NULL DEFAULT 'pending',
  `didit_session_id` char(36) DEFAULT NULL,
  `didit_url` text DEFAULT NULL,
  `workflow_id` char(36) DEFAULT NULL,
  `entorno` varchar(16) NOT NULL,
  `consentimiento` varchar(40) NOT NULL,
  `creado` bigint(20) NOT NULL,
  `expira` bigint(20) NOT NULL,
  `ultima_consulta` bigint(20) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `aulify_registros_pendientes`
--

INSERT INTO `aulify_registros_pendientes` (`id`, `ticket_hash`, `owner_hash`, `email_hash`, `datos`, `estado`, `didit_session_id`, `didit_url`, `workflow_id`, `entorno`, `consentimiento`, `creado`, `expira`, `ultima_consulta`) VALUES
('0c10e929b4e5feeb74128d822506dbbf', 'a28d3f1789de1040d6d27b853f54b9af25a71edba155808084a3ae254e170a59', 'bbf96232fb8a66fbeebb76d920c19ba742440d8b119d5c5e7fa804753cf229c0', '7069451e36c82b66881511c711d696db81e19053f9eae2d6256c0b00f976a244', NULL, 'cancelled', '62567ad7-930d-4d99-930b-db9324f03d94', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791387600, 1791391200, 1791387729),
('2200ac490c055edc12f09b3349787510', 'cb314fbe6f0b0afba4d970845f3267f9add58a0c773a9438c38e42ce96a41f0c', 'bd79024f30ffc3b91b457c98178c50a05e0a422987e450b50fcb89d7817ac531', '9311c57a327cad7553444c8403a16ec9c59803d1bc0ac7614296e8bdd7fcae9a', '{\"nombre\":\"Mar\\u00eda\",\"apellido\":\"P\\u00e9rez\",\"email\":\"demo-8a9314b1bfd517855fd6727ecec26c39@example.invalid\",\"dni\":\"12345678\",\"password_hash\":\"$2y$10$HZ8eelIc7GOcOrTsKHfRIeJcUhdl85FjX9EKcR5VzDox6lDby4LCq\"}', 'pending', NULL, NULL, NULL, 'sandbox', 'sandbox-demo-no-personal-data', 1791925735, 1791929335, 0),
('301b72147a13dc9a1bb44b9427421a2c', 'b82d43d9463b0286ce93c5632b171f190ed3c04d6c945507c017861d39109e35', '5bbb015da59fb7d9a0f8b896a6f88dffcbb5f8887bdfd3f42e0cea055787774b', '43bec2ff9ff444a4eb03d2bb893e8d71138acca620ea97563a60357e7c9c2528', NULL, 'cancelled', NULL, NULL, NULL, 'sandbox', 'sandbox-demo-no-personal-data', 1791926262, 1791929862, 0),
('36a0901be38ec4bb48698380a69b1b7a', 'e5e0e1addf9525d99ef958b1c0258510ada9dfcbd22848b2bb10e703873d79c3', '8df5fb1900fc15bf61132213e825eb7aa9c2af1d860999273603e53bd44726c9', 'f7589e7dccc35d256265ae37e995c7dde9ce3dcfebba99f294cc3f6a2317a797', NULL, 'expired', '44761daf-7313-4af3-9258-82a6d1f96f3e', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791508248, 1791511848, 1791508351),
('665df698df0bcabc0304e9219ea67d63', '2440a18a282b06deb0327a06d17b0eb7577061235c19e2a360a0ae5fe5e6ec50', 'bbf96232fb8a66fbeebb76d920c19ba742440d8b119d5c5e7fa804753cf229c0', '7069451e36c82b66881511c711d696db81e19053f9eae2d6256c0b00f976a244', NULL, 'cancelled', '8b64143d-de00-4907-b40e-f26d34641534', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791392779, 1791396379, 1791392867),
('701affd96f1deb6a5a43d12d3761fa9d', '66e5be132a67822a4c00570c99bd6588725e481823af8f74281c5bd075a5d64c', '5b7542d40c561641993082ab81df551f3fbd4c50efd022e3d99cf02aada65b40', '1999038708ce6cd1ff7d8cba05b93e2206cf00b4c0f5c244f10d90b7e7b82b84', NULL, 'cancelled', NULL, NULL, NULL, 'sandbox', 'didit-dni-selfie-2026-10-06', 1791391644, 1791395244, 0),
('a5a6a8b22870fd4dcbfec26e24817844', '40dc6e28811f72002dab1c5994b5618a9e6a3f8554df613e97c3cbfc896de55f', '98d674e1ae327375086806b95a3d88172ab52254fa16f70703390c4d0a82f764', 'f7589e7dccc35d256265ae37e995c7dde9ce3dcfebba99f294cc3f6a2317a797', NULL, 'cancelled', '04d672aa-0d44-4289-945f-c737db6f9949', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791503404, 1791507004, 1791503537),
('b8d7770263f7dc71c105b2cdce6058af', '9d9ac165e1415c0b3e497bc681db4c0f3c856a19f766271da0c11818d16ffe3a', 'bbf96232fb8a66fbeebb76d920c19ba742440d8b119d5c5e7fa804753cf229c0', '7069451e36c82b66881511c711d696db81e19053f9eae2d6256c0b00f976a244', NULL, 'cancelled', '12f80d0d-95fc-402e-9b71-ee01e13f05bd', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791401937, 1791405537, 1791402148),
('c1e9bd00eca71f72296862944e220d45', 'b4b0463ae9b2cf033300a92cc22ef94a386ca5eb35a4332d7efebe624ec2866f', 'bbf96232fb8a66fbeebb76d920c19ba742440d8b119d5c5e7fa804753cf229c0', '7069451e36c82b66881511c711d696db81e19053f9eae2d6256c0b00f976a244', NULL, 'expired', 'ebe188ce-8ed0-48c6-8a1f-2a160d467d5b', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791415079, 1791418679, 1791415153),
('fb2e3cc408dcdaccdeeca2ce5a222498', 'dd387559f6d9ea4c4c6f5d0742ffe20817e5d868444f00536922b666eb699de3', '5bbb015da59fb7d9a0f8b896a6f88dffcbb5f8887bdfd3f42e0cea055787774b', '182ac7d85131778bbb2ea739e14475274487339f6dbc180b65276d71d80b7682', NULL, 'cancelled', NULL, NULL, NULL, 'sandbox', 'sandbox-demo-no-personal-data', 1791925762, 1791929362, 0),
('fe598f6c8057f818fde057e3eac6f0f9', '19d1d0c9195531c5f14ab22451ab4980fd226e4f203bef9a4305052675ae9a97', 'c77a621bf6d997b65a8b411f0ce792228b79b1e07c15a755b123268263d7cfdc', 'cd855bf377cb327ca9e8e35b3c6e1afe738da1932331589318ba58e6abf9d74f', NULL, 'expired', '7d127930-525f-4374-a01d-9558d0ade1b9', NULL, '3618b122-8d79-47af-8da9-ac7eb8132d2e', 'sandbox', 'didit-dni-selfie-2026-10-06', 1791916612, 1791920212, 1791918148);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_reservas`
--

CREATE TABLE `aulify_reservas` (
  `id` bigint(20) NOT NULL,
  `clase_id` bigint(20) NOT NULL,
  `profesor_id` bigint(20) NOT NULL,
  `alumno_id` bigint(20) NOT NULL,
  `inicio` datetime NOT NULL,
  `fin` datetime NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'confirmada',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `modalidad` varchar(20) NOT NULL DEFAULT 'virtual',
  `permite_chat` tinyint(4) NOT NULL DEFAULT 0,
  `pago_metodo` varchar(20) DEFAULT NULL,
  `pago_referencia` varchar(60) DEFAULT NULL,
  `pagado_en` datetime DEFAULT NULL,
  `reembolso` decimal(10,2) DEFAULT NULL,
  `alumno_leido` bigint(20) NOT NULL DEFAULT 0,
  `profesor_leido` bigint(20) NOT NULL DEFAULT 0,
  `moneda` char(3) NOT NULL DEFAULT 'EUR'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `aulify_reservas`
--

INSERT INTO `aulify_reservas` (`id`, `clase_id`, `profesor_id`, `alumno_id`, `inicio`, `fin`, `precio`, `estado`, `creado_en`, `modalidad`, `permite_chat`, `pago_metodo`, `pago_referencia`, `pagado_en`, `reembolso`, `alumno_leido`, `profesor_leido`, `moneda`) VALUES
(4, 4, 9, 10, '2026-10-14 11:00:00', '2026-10-14 12:00:00', 15.00, 'pagada', '2026-10-13 20:17:37', 'virtual', 0, 'qr', 'SIM-4-FA7321342C', '2026-10-13 17:18:13', NULL, 0, 0, 'EUR');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aulify_reserva_mensajes`
--

CREATE TABLE `aulify_reserva_mensajes` (
  `id` bigint(20) NOT NULL,
  `reserva_id` bigint(20) NOT NULL,
  `usuario_id` bigint(20) NOT NULL,
  `texto` text NOT NULL,
  `creado_en` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clase`
--

CREATE TABLE `clase` (
  `id_clase` bigint(20) NOT NULL,
  `dia` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `materias`
--

CREATE TABLE `materias` (
  `id_mat` bigint(20) NOT NULL,
  `nom_mat` varchar(255) NOT NULL,
  `precio` bigint(20) NOT NULL,
  `descp` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `solicitudes_profesor`
--

CREATE TABLE `solicitudes_profesor` (
  `usuario_id` bigint(20) NOT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `nombre_usuario` varchar(50) NOT NULL,
  `experiencia` text NOT NULL,
  `descripcion` text NOT NULL,
  `motivacion` text NOT NULL,
  `estudios` text NOT NULL,
  `imagen_titulo` mediumblob DEFAULT NULL,
  `titulo_mime` varchar(32) DEFAULT NULL,
  `titulo_nombre` varchar(120) DEFAULT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `revision_motivo` text DEFAULT NULL,
  `revisado_por` bigint(20) DEFAULT NULL,
  `revisado_en` datetime DEFAULT NULL,
  `materia` varchar(100) DEFAULT NULL,
  `email_solicitud` varchar(254) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `solicitudes_profesor`
--

INSERT INTO `solicitudes_profesor` (`usuario_id`, `nombre_completo`, `nombre_usuario`, `experiencia`, `descripcion`, `motivacion`, `estudios`, `imagen_titulo`, `titulo_mime`, `titulo_nombre`, `estado`, `creado_en`, `actualizado_en`, `revision_motivo`, `revisado_por`, `revisado_en`, `materia`, `email_solicitud`) VALUES
(9, 'Admin Prueba', 'pepito', 'anaseheindhasñlk hskdjhdksj', 'FGHKLJFHSDJLKFHDSKJLFHLDSHAF', 'kfjdsjkhkjlsdfhfdsjkhflsdjkhflsdk', '[\"secundaria\",\"universidad\"]', NULL, NULL, NULL, 'aprobada', '2026-10-07 23:05:43', '2026-10-08 18:32:35', '', 9, '2026-10-08 18:32:35', NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `titulos`
--

CREATE TABLE `titulos` (
  `id_titulos` bigint(20) NOT NULL,
  `fecha` date NOT NULL,
  `nom` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` bigint(20) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `apellido` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `username` varchar(50) DEFAULT NULL,
  `foto_perfil` varchar(255) DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT NULL,
  `experiencia` text DEFAULT NULL,
  `titulos` text DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `fotos_experiencia` text DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `dni` bigint(20) NOT NULL,
  `rol` smallint(6) DEFAULT NULL,
  `fecha_usu` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `apellido`, `email`, `username`, `foto_perfil`, `rating`, `experiencia`, `titulos`, `descripcion`, `fotos_experiencia`, `password_hash`, `dni`, `rol`, `fecha_usu`) VALUES
(1, 'as', 'asd', 'francogelato2007@gmail.com', 'Sias', 'Backend/conexiones/uploads/perfiles/1_ebdedead5bdbe840.jpg', 0.0, '', '', '', '', '$2y$10$xuUbE78vhMkWHkh4m1VqKem.JtVK8o3lGEtiRhi/9jJLyJ2yMPVdG', 45454545, NULL, '2026-08-26'),
(7, 'franco', 'gelato', 'francogelato2007@hotmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '$2y$10$FNg5MseGyYvjueY3wOq3WOvRGxCqf0IqvHGl6at3zhq2BEeRTvghK', 4544545454, NULL, '2026-09-03'),
(9, 'Admin', 'Prueba', 'admin@aulify.invalid', 'pepito', 'Backend/conexiones/uploads/perfiles/9_32ecc40908f7883d.jpg', 0.0, 'lei 2 libros', '', '', '[\"Backend/conexiones/uploads/perfiles/9_experiencia_57585780c08fd66c.png\"]', '$2y$10$5jOrEylot2coLTo2UxJoq.Dgg2T9RLq1AgrFgbQtQMu16X96q17LO', 0, NULL, '2026-10-07'),
(10, 'Alumno', 'Prueba', 'alumno@aulify.invalid', 'alumno', NULL, NULL, NULL, NULL, NULL, NULL, '$2y$10$HQwArmvjtoYRUesEbcqRC.q5FC5FME5wboT48gV4POcJMDOxeR3Ie', 0, NULL, '2026-10-09');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `apuntes`
--
ALTER TABLE `apuntes`
  ADD PRIMARY KEY (`id_apuntes`);

--
-- Indices de la tabla `aulify_administradores`
--
ALTER TABLE `aulify_administradores`
  ADD PRIMARY KEY (`usuario_id`);

--
-- Indices de la tabla `aulify_apuntes`
--
ALTER TABLE `aulify_apuntes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`,`carpeta_id`,`id`),
  ADD KEY `carpeta_id` (`carpeta_id`);

--
-- Indices de la tabla `aulify_carpetas`
--
ALTER TABLE `aulify_carpetas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`,`id`);

--
-- Indices de la tabla `aulify_clases`
--
ALTER TABLE `aulify_clases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `profesor_id` (`profesor_id`);

--
-- Indices de la tabla `aulify_correos`
--
ALTER TABLE `aulify_correos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evento` (`evento`);

--
-- Indices de la tabla `aulify_identidades_verificadas`
--
ALTER TABLE `aulify_identidades_verificadas`
  ADD PRIMARY KEY (`usuario_id`),
  ADD UNIQUE KEY `didit_session_id` (`didit_session_id`);

--
-- Indices de la tabla `aulify_materias`
--
ALTER TABLE `aulify_materias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `aulify_registros_pendientes`
--
ALTER TABLE `aulify_registros_pendientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ticket_hash` (`ticket_hash`),
  ADD UNIQUE KEY `didit_session_id` (`didit_session_id`),
  ADD KEY `idx_owner_creado` (`owner_hash`,`creado`),
  ADD KEY `idx_email_creado` (`email_hash`,`creado`);

--
-- Indices de la tabla `aulify_reservas`
--
ALTER TABLE `aulify_reservas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reserva_profesor_hora` (`profesor_id`,`inicio`,`fin`),
  ADD KEY `reserva_alumno_hora` (`alumno_id`,`inicio`,`fin`),
  ADD KEY `clase_id` (`clase_id`);

--
-- Indices de la tabla `aulify_reserva_mensajes`
--
ALTER TABLE `aulify_reserva_mensajes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reserva_id` (`reserva_id`,`id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indices de la tabla `clase`
--
ALTER TABLE `clase`
  ADD PRIMARY KEY (`id_clase`);

--
-- Indices de la tabla `materias`
--
ALTER TABLE `materias`
  ADD PRIMARY KEY (`id_mat`);

--
-- Indices de la tabla `solicitudes_profesor`
--
ALTER TABLE `solicitudes_profesor`
  ADD PRIMARY KEY (`usuario_id`);

--
-- Indices de la tabla `titulos`
--
ALTER TABLE `titulos`
  ADD PRIMARY KEY (`id_titulos`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `apuntes`
--
ALTER TABLE `apuntes`
  MODIFY `id_apuntes` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `aulify_apuntes`
--
ALTER TABLE `aulify_apuntes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `aulify_carpetas`
--
ALTER TABLE `aulify_carpetas`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `aulify_clases`
--
ALTER TABLE `aulify_clases`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `aulify_correos`
--
ALTER TABLE `aulify_correos`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `aulify_materias`
--
ALTER TABLE `aulify_materias`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de la tabla `aulify_reservas`
--
ALTER TABLE `aulify_reservas`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `aulify_reserva_mensajes`
--
ALTER TABLE `aulify_reserva_mensajes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `clase`
--
ALTER TABLE `clase`
  MODIFY `id_clase` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `materias`
--
ALTER TABLE `materias`
  MODIFY `id_mat` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `titulos`
--
ALTER TABLE `titulos`
  MODIFY `id_titulos` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `aulify_administradores`
--
ALTER TABLE `aulify_administradores`
  ADD CONSTRAINT `fk_admin_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `aulify_apuntes`
--
ALTER TABLE `aulify_apuntes`
  ADD CONSTRAINT `aulify_apuntes_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `aulify_apuntes_ibfk_2` FOREIGN KEY (`carpeta_id`) REFERENCES `aulify_carpetas` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `aulify_carpetas`
--
ALTER TABLE `aulify_carpetas`
  ADD CONSTRAINT `aulify_carpetas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `aulify_clases`
--
ALTER TABLE `aulify_clases`
  ADD CONSTRAINT `aulify_clases_ibfk_1` FOREIGN KEY (`profesor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `aulify_reservas`
--
ALTER TABLE `aulify_reservas`
  ADD CONSTRAINT `aulify_reservas_ibfk_1` FOREIGN KEY (`clase_id`) REFERENCES `aulify_clases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `aulify_reservas_ibfk_2` FOREIGN KEY (`profesor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `aulify_reservas_ibfk_3` FOREIGN KEY (`alumno_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `aulify_reserva_mensajes`
--
ALTER TABLE `aulify_reserva_mensajes`
  ADD CONSTRAINT `aulify_reserva_mensajes_ibfk_1` FOREIGN KEY (`reserva_id`) REFERENCES `aulify_reservas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `aulify_reserva_mensajes_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `solicitudes_profesor`
--
ALTER TABLE `solicitudes_profesor`
  ADD CONSTRAINT `fk_solicitud_profesor_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
