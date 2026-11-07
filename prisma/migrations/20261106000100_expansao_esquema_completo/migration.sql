-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `atualizadoEm` DATETIME(3) NULL,
    ADD COLUMN `emailVerificado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `imagem` TEXT NULL,
    ADD COLUMN `papel` VARCHAR(30) NULL,
    MODIFY `papeis` JSON NULL,
    MODIFY `situacao` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    MODIFY `campus` VARCHAR(50) NOT NULL DEFAULT 'Pinheiral';

-- AlterTable
ALTER TABLE `matriculas` ADD COLUMN `cursoId` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `dados_pessoais_alunos` (
    `id` VARCHAR(64) NOT NULL,
    `usuarioId` VARCHAR(64) NOT NULL,
    `cpf` VARCHAR(14) NOT NULL,
    `rg` VARCHAR(20) NOT NULL,
    `dataNascimento` DATE NOT NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `celular` VARCHAR(20) NOT NULL,
    `endereco` JSON NOT NULL,
    `cursoId` VARCHAR(64) NOT NULL,
    `turmaId` VARCHAR(64) NOT NULL,
    `periodoId` VARCHAR(64) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dados_pessoais_alunos_usuarioId_key`(`usuarioId`),
    INDEX `dados_pessoais_alunos_cursoId_idx`(`cursoId`),
    INDEX `dados_pessoais_alunos_turmaId_idx`(`turmaId`),
    INDEX `dados_pessoais_alunos_periodoId_idx`(`periodoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cursos` (
    `id` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(50) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cursos_codigo_key`(`codigo`),
    INDEX `cursos_situacao_idx`(`situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turmas` (
    `id` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cursoId` VARCHAR(64) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `turmas_cursoId_idx`(`cursoId`),
    INDEX `turmas_situacao_idx`(`situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periodos` (
    `id` VARCHAR(64) NOT NULL,
    `rotulo` VARCHAR(50) NOT NULL,
    `ano` INTEGER NOT NULL,
    `semestre` INTEGER NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `periodos_situacao_idx`(`situacao`),
    UNIQUE INDEX `periodos_ano_semestre_key`(`ano`, `semestre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turmas_periodos` (
    `turmaId` VARCHAR(64) NOT NULL,
    `periodoId` VARCHAR(64) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `turmas_periodos_periodoId_idx`(`periodoId`),
    PRIMARY KEY (`turmaId`, `periodoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `auth_accounts_userId_idx`(`userId`),
    UNIQUE INDEX `auth_accounts_providerId_accountId_key`(`providerId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ipAddress` TEXT NULL,
    `userAgent` TEXT NULL,
    `userId` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `auth_sessions_token_key`(`token`),
    INDEX `auth_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_verifications` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` TEXT NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `auth_verifications_identifier_idx`(`identifier`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacoes_acesso` (
    `id` VARCHAR(64) NOT NULL,
    `usuarioId` VARCHAR(64) NOT NULL,
    `cursoId` VARCHAR(64) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    `motivo` TEXT NULL,
    `decididoPorId` VARCHAR(64) NULL,
    `decididoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solicitacoes_acesso_usuarioId_key`(`usuarioId`),
    INDEX `solicitacoes_acesso_situacao_criadoEm_idx`(`situacao`, `criadoEm`),
    INDEX `solicitacoes_acesso_cursoId_situacao_idx`(`cursoId`, `situacao`),
    INDEX `solicitacoes_acesso_decididoPorId_idx`(`decididoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `importacoes_matriculas` (
    `id` VARCHAR(64) NOT NULL,
    `arquivo` VARCHAR(255) NOT NULL,
    `importadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validas` INTEGER NOT NULL DEFAULT 0,
    `rejeitadas` INTEGER NOT NULL DEFAULT 0,
    `ignoradas` INTEGER NOT NULL DEFAULT 0,

    INDEX `importacoes_matriculas_importadoEm_idx`(`importadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itens_importacao_matricula` (
    `id` VARCHAR(64) NOT NULL,
    `importacaoId` VARCHAR(64) NOT NULL,
    `matricula` VARCHAR(20) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `resultado` VARCHAR(20) NOT NULL,
    `motivo` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itens_importacao_matricula_importacaoId_resultado_idx`(`importacaoId`, `resultado`),
    INDEX `itens_importacao_matricula_matricula_idx`(`matricula`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instituicoes_concedentes` (
    `id` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(18) NOT NULL,
    `campus` VARCHAR(50) NOT NULL DEFAULT 'Pinheiral',
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instituicoes_concedentes_cnpj_key`(`cnpj`),
    INDEX `instituicoes_concedentes_situacao_idx`(`situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `responsaveis_instituicao` (
    `id` VARCHAR(64) NOT NULL,
    `instituicaoId` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `cargo` VARCHAR(80) NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `responsaveis_instituicao_instituicaoId_situacao_idx`(`instituicaoId`, `situacao`),
    UNIQUE INDEX `responsaveis_instituicao_instituicaoId_email_key`(`instituicaoId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenios` (
    `id` VARCHAR(64) NOT NULL,
    `instituicaoId` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `inicioVigencia` DATE NOT NULL,
    `fimVigencia` DATE NOT NULL,
    `campus` VARCHAR(50) NOT NULL DEFAULT 'Pinheiral',
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `renovacoes` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `convenios_instituicaoId_situacao_idx`(`instituicaoId`, `situacao`),
    INDEX `convenios_fimVigencia_idx`(`fimVigencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `renovacoes_convenio` (
    `id` VARCHAR(64) NOT NULL,
    `convenioId` VARCHAR(64) NOT NULL,
    `inicioVigencia` DATE NOT NULL,
    `fimVigencia` DATE NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `renovacoes_convenio_convenioId_criadoEm_idx`(`convenioId`, `criadoEm`),
    UNIQUE INDEX `renovacoes_convenio_convenioId_inicioVigencia_key`(`convenioId`, `inicioVigencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pessoas` (
    `id` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `papel` VARCHAR(20) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'ativo',
    `cpf` VARCHAR(14) NULL,
    `rg` VARCHAR(20) NULL,
    `endereco` JSON NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `pessoas_papel_situacao_idx`(`papel`, `situacao`),
    INDEX `pessoas_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estagios` (
    `id` VARCHAR(64) NOT NULL,
    `alunoId` VARCHAR(64) NOT NULL,
    `convenioId` VARCHAR(64) NOT NULL,
    `supervisorId` VARCHAR(64) NOT NULL,
    `orientadorId` VARCHAR(64) NOT NULL,
    `dataInicio` DATE NOT NULL,
    `dataFim` DATE NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'em_preparacao',
    `cargaHorariaPrevistaMinutos` INTEGER NULL,
    `encaminhadoEm` DATETIME(3) NULL,
    `encaminhadoPorId` VARCHAR(64) NULL,
    `liberadoEm` DATETIME(3) NULL,
    `liberadoPorId` VARCHAR(64) NULL,
    `canceladoEm` DATETIME(3) NULL,
    `excluidoEm` DATETIME(3) NULL,
    `nomeAlunoHistorico` VARCHAR(191) NULL,
    `cursoIdHistorico` VARCHAR(64) NULL,
    `editadoPorId` VARCHAR(64) NULL,
    `editadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `estagios_alunoId_situacao_dataInicio_idx`(`alunoId`, `situacao`, `dataInicio`),
    INDEX `estagios_situacao_dataInicio_idx`(`situacao`, `dataInicio`),
    INDEX `estagios_convenioId_idx`(`convenioId`),
    INDEX `estagios_supervisorId_idx`(`supervisorId`),
    INDEX `estagios_orientadorId_idx`(`orientadorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estagios_templates` (
    `estagioId` VARCHAR(64) NOT NULL,
    `templateId` VARCHAR(100) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `estagios_templates_templateId_idx`(`templateId`),
    PRIMARY KEY (`estagioId`, `templateId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_preenchidos` (
    `id` VARCHAR(64) NOT NULL,
    `templateId` VARCHAR(100) NOT NULL,
    `alunoId` VARCHAR(64) NOT NULL,
    `estagioId` VARCHAR(64) NULL,
    `versaoTemplate` INTEGER NOT NULL,
    `definicaoChecksum` VARCHAR(64) NOT NULL,
    `definicaoSnapshot` JSON NOT NULL,
    `valores` JSON NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `inativadoEm` DATETIME(3) NULL,
    `registradoPorId` VARCHAR(64) NULL,
    `registradoEm` DATETIME(3) NULL,
    `assinaturasConfirmadasPorId` VARCHAR(64) NULL,
    `assinaturasConfirmadasEm` DATETIME(3) NULL,
    `correcaoAberta` BOOLEAN NOT NULL DEFAULT false,

    INDEX `documentos_preenchidos_estagioId_situacao_idx`(`estagioId`, `situacao`),
    INDEX `documentos_preenchidos_alunoId_situacao_idx`(`alunoId`, `situacao`),
    INDEX `documentos_preenchidos_templateId_situacao_idx`(`templateId`, `situacao`),
    INDEX `documentos_preenchidos_situacao_criadoEm_idx`(`situacao`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `arquivos` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NULL,
    `nome` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `tamanhoBytes` INTEGER NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `conteudo` LONGBLOB NOT NULL,
    `autorId` VARCHAR(64) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `arquivos_documentoId_idx`(`documentoId`),
    INDEX `arquivos_autorId_idx`(`autorId`),
    INDEX `arquivos_checksum_idx`(`checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lancamentos_horas` (
    `id` VARCHAR(64) NOT NULL,
    `estagioId` VARCHAR(64) NOT NULL,
    `alunoId` VARCHAR(64) NOT NULL,
    `data` DATE NOT NULL,
    `entrada` VARCHAR(5) NOT NULL,
    `saida` VARCHAR(5) NOT NULL,
    `almocoDesligado` BOOLEAN NOT NULL DEFAULT false,
    `minutos` INTEGER NOT NULL,
    `tipo` VARCHAR(20) NOT NULL DEFAULT 'lancamento',
    `corrigeId` VARCHAR(64) NULL,
    `sequenciaCorrecao` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lancamentos_horas_estagioId_data_criadoEm_idx`(`estagioId`, `data`, `criadoEm`),
    INDEX `lancamentos_horas_alunoId_data_idx`(`alunoId`, `data`),
    UNIQUE INDEX `lancamentos_horas_corrigeId_sequenciaCorrecao_key`(`corrigeId`, `sequenciaCorrecao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissoes_documento` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NOT NULL,
    `versao` INTEGER NOT NULL,
    `autorId` VARCHAR(64) NOT NULL,
    `submetidoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `observacao` TEXT NULL,
    `estagioId` VARCHAR(64) NULL,

    INDEX `submissoes_documento_documentoId_submetidoEm_idx`(`documentoId`, `submetidoEm`),
    INDEX `submissoes_documento_autorId_idx`(`autorId`),
    UNIQUE INDEX `submissoes_documento_documentoId_versao_key`(`documentoId`, `versao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pareceres` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NOT NULL,
    `decisao` VARCHAR(20) NOT NULL,
    `consideracoes` TEXT NULL,
    `autorId` VARCHAR(64) NOT NULL,
    `fila` VARCHAR(30) NOT NULL,
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pareceres_documentoId_data_idx`(`documentoId`, `data`),
    INDEX `pareceres_fila_data_idx`(`fila`, `data`),
    INDEX `pareceres_autorId_idx`(`autorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observacoes_documento` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NOT NULL,
    `conteudo` TEXT NOT NULL,
    `autorId` VARCHAR(64) NOT NULL,
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `observacoes_documento_documentoId_data_idx`(`documentoId`, `data`),
    INDEX `observacoes_documento_autorId_idx`(`autorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacoes_exclusao_estagio` (
    `id` VARCHAR(64) NOT NULL,
    `estagioId` VARCHAR(64) NOT NULL,
    `solicitanteId` VARCHAR(64) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    `motivo` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decididoEm` DATETIME(3) NULL,
    `decididoPorId` VARCHAR(64) NULL,

    INDEX `solicitacoes_exclusao_estagio_estagioId_situacao_idx`(`estagioId`, `situacao`),
    INDEX `solicitacoes_exclusao_estagio_situacao_criadoEm_idx`(`situacao`, `criadoEm`),
    INDEX `solicitacoes_exclusao_estagio_decididoPorId_idx`(`decididoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidos_envio_documento` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NOT NULL,
    `pedidoPorId` VARCHAR(64) NOT NULL,
    `situacao` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    `motivo` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `pedidos_envio_documento_documentoId_situacao_idx`(`documentoId`, `situacao`),
    INDEX `pedidos_envio_documento_situacao_criadoEm_idx`(`situacao`, `criadoEm`),
    INDEX `pedidos_envio_documento_pedidoPorId_idx`(`pedidoPorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `envios_externos` (
    `id` VARCHAR(64) NOT NULL,
    `documentoId` VARCHAR(64) NOT NULL,
    `pedidoId` VARCHAR(64) NULL,
    `destinatario` VARCHAR(191) NOT NULL,
    `destinatarioEmail` VARCHAR(191) NOT NULL,
    `destinatarioPapel` VARCHAR(50) NULL,
    `autorId` VARCHAR(64) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    `erro` TEXT NULL,
    `tentativa` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enviadoEm` DATETIME(3) NULL,

    INDEX `envios_externos_documentoId_criadoEm_idx`(`documentoId`, `criadoEm`),
    INDEX `envios_externos_status_criadoEm_idx`(`status`, `criadoEm`),
    UNIQUE INDEX `envios_externos_pedidoId_tentativa_key`(`pedidoId`, `tentativa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_matricula_key` ON `usuarios`(`matricula`);

-- CreateIndex
CREATE INDEX `usuarios_papel_idx` ON `usuarios`(`papel`);

-- CreateIndex
CREATE INDEX `usuarios_cursoId_idx` ON `usuarios`(`cursoId`);

-- CreateIndex
CREATE INDEX `matriculas_cursoId_idx` ON `matriculas`(`cursoId`);

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `cursos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dados_pessoais_alunos` ADD CONSTRAINT `dados_pessoais_alunos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dados_pessoais_alunos` ADD CONSTRAINT `dados_pessoais_alunos_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `cursos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dados_pessoais_alunos` ADD CONSTRAINT `dados_pessoais_alunos_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dados_pessoais_alunos` ADD CONSTRAINT `dados_pessoais_alunos_periodoId_fkey` FOREIGN KEY (`periodoId`) REFERENCES `periodos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turmas` ADD CONSTRAINT `turmas_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `cursos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turmas_periodos` ADD CONSTRAINT `turmas_periodos_turmaId_fkey` FOREIGN KEY (`turmaId`) REFERENCES `turmas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turmas_periodos` ADD CONSTRAINT `turmas_periodos_periodoId_fkey` FOREIGN KEY (`periodoId`) REFERENCES `periodos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_accounts` ADD CONSTRAINT `auth_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `cursos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_acesso` ADD CONSTRAINT `solicitacoes_acesso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_acesso` ADD CONSTRAINT `solicitacoes_acesso_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `cursos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_acesso` ADD CONSTRAINT `solicitacoes_acesso_decididoPorId_fkey` FOREIGN KEY (`decididoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itens_importacao_matricula` ADD CONSTRAINT `itens_importacao_matricula_importacaoId_fkey` FOREIGN KEY (`importacaoId`) REFERENCES `importacoes_matriculas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `responsaveis_instituicao` ADD CONSTRAINT `responsaveis_instituicao_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `instituicoes_concedentes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `convenios` ADD CONSTRAINT `convenios_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `instituicoes_concedentes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `renovacoes_convenio` ADD CONSTRAINT `renovacoes_convenio_convenioId_fkey` FOREIGN KEY (`convenioId`) REFERENCES `convenios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_convenioId_fkey` FOREIGN KEY (`convenioId`) REFERENCES `convenios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `pessoas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_orientadorId_fkey` FOREIGN KEY (`orientadorId`) REFERENCES `pessoas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_encaminhadoPorId_fkey` FOREIGN KEY (`encaminhadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_liberadoPorId_fkey` FOREIGN KEY (`liberadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios` ADD CONSTRAINT `estagios_editadoPorId_fkey` FOREIGN KEY (`editadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estagios_templates` ADD CONSTRAINT `estagios_templates_estagioId_fkey` FOREIGN KEY (`estagioId`) REFERENCES `estagios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_preenchidos` ADD CONSTRAINT `documentos_preenchidos_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_preenchidos` ADD CONSTRAINT `documentos_preenchidos_estagioId_fkey` FOREIGN KEY (`estagioId`) REFERENCES `estagios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_preenchidos` ADD CONSTRAINT `documentos_preenchidos_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_preenchidos` ADD CONSTRAINT `documentos_preenchidos_assinaturasConfirmadasPorId_fkey` FOREIGN KEY (`assinaturasConfirmadasPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `arquivos` ADD CONSTRAINT `arquivos_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `arquivos` ADD CONSTRAINT `arquivos_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos_horas` ADD CONSTRAINT `lancamentos_horas_estagioId_fkey` FOREIGN KEY (`estagioId`) REFERENCES `estagios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos_horas` ADD CONSTRAINT `lancamentos_horas_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos_horas` ADD CONSTRAINT `lancamentos_horas_corrigeId_fkey` FOREIGN KEY (`corrigeId`) REFERENCES `lancamentos_horas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes_documento` ADD CONSTRAINT `submissoes_documento_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes_documento` ADD CONSTRAINT `submissoes_documento_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissoes_documento` ADD CONSTRAINT `submissoes_documento_estagioId_fkey` FOREIGN KEY (`estagioId`) REFERENCES `estagios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pareceres` ADD CONSTRAINT `pareceres_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pareceres` ADD CONSTRAINT `pareceres_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observacoes_documento` ADD CONSTRAINT `observacoes_documento_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observacoes_documento` ADD CONSTRAINT `observacoes_documento_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_exclusao_estagio` ADD CONSTRAINT `solicitacoes_exclusao_estagio_estagioId_fkey` FOREIGN KEY (`estagioId`) REFERENCES `estagios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_exclusao_estagio` ADD CONSTRAINT `solicitacoes_exclusao_estagio_solicitanteId_fkey` FOREIGN KEY (`solicitanteId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_exclusao_estagio` ADD CONSTRAINT `solicitacoes_exclusao_estagio_decididoPorId_fkey` FOREIGN KEY (`decididoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos_envio_documento` ADD CONSTRAINT `pedidos_envio_documento_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos_envio_documento` ADD CONSTRAINT `pedidos_envio_documento_pedidoPorId_fkey` FOREIGN KEY (`pedidoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_externos` ADD CONSTRAINT `envios_externos_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documentos_preenchidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_externos` ADD CONSTRAINT `envios_externos_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos_envio_documento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_externos` ADD CONSTRAINT `envios_externos_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

