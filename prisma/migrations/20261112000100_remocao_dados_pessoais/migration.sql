-- Registro mínimo de remoções de dados pessoais. Reaplicado após restaurações
-- de backup, antes de reabrir consultas (tarefa 11.4).
CREATE TABLE `remocoes_dados_pessoais` (
    `id` VARCHAR(64) NOT NULL,
    `alvoTipo` VARCHAR(20) NOT NULL,
    `alvoId` VARCHAR(64) NOT NULL,
    `registradoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `remocoes_dados_pessoais_registradoEm_idx`(`registradoEm`),
    INDEX `remocoes_dados_pessoais_alvoTipo_alvoId_idx`(`alvoTipo`, `alvoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
