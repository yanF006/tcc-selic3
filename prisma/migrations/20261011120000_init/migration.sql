-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `papeis` JSON NOT NULL,
    `situacao` VARCHAR(20) NOT NULL,
    `campus` VARCHAR(50) NOT NULL,
    `matricula` VARCHAR(20) NULL,
    `cursoId` VARCHAR(64) NULL,
    `membroComissaoEstagio` BOOLEAN NOT NULL DEFAULT false,
    `dadosPessoais` JSON NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_situacao_idx`(`situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matriculas` (
    `id` VARCHAR(64) NOT NULL,
    `matricula` VARCHAR(20) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(30) NOT NULL,
    `importadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `matriculas_matricula_key`(`matricula`),
    INDEX `matriculas_origem_idx`(`origem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
