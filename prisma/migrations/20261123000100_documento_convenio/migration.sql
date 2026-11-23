-- Valores do documento "Convênio de Estágio" preenchido no cadastro do
-- convênio; usados para completar os dados da concedente nos demais documentos.
ALTER TABLE `convenios` ADD COLUMN `dadosDocumento` JSON NULL;
