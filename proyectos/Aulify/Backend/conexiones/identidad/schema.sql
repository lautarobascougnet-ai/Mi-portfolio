CREATE TABLE IF NOT EXISTS aulify_registros_pendientes (
	id CHAR(32) PRIMARY KEY,
	ticket_hash CHAR(64) NOT NULL UNIQUE,
	owner_hash CHAR(64) NOT NULL,
	email_hash CHAR(64) NOT NULL,
	datos MEDIUMTEXT NULL,
	estado VARCHAR(32) NOT NULL DEFAULT 'pending',
	didit_session_id CHAR(36) NULL UNIQUE,
	didit_url TEXT NULL,
	workflow_id CHAR(36) NULL,
	entorno VARCHAR(16) NOT NULL,
	consentimiento VARCHAR(40) NOT NULL,
	creado BIGINT NOT NULL,
	expira BIGINT NOT NULL,
	ultima_consulta BIGINT NOT NULL DEFAULT 0,
	INDEX idx_owner_creado (owner_hash, creado),
	INDEX idx_email_creado (email_hash, creado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aulify_identidades_verificadas (
	usuario_id BIGINT NOT NULL PRIMARY KEY,
	didit_session_id CHAR(36) NOT NULL UNIQUE,
	workflow_id CHAR(36) NOT NULL,
	verificado BIGINT NOT NULL,
	consentimiento VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
