ALTER TABLE usuarios
    ADD COLUMN rating DECIMAL(2,1) NULL AFTER foto_perfil,
    ADD COLUMN experiencia TEXT NULL AFTER rating,
    ADD COLUMN titulos TEXT NULL AFTER experiencia,
    ADD COLUMN descripcion TEXT NULL AFTER titulos,
    ADD COLUMN fotos_experiencia TEXT NULL AFTER descripcion;