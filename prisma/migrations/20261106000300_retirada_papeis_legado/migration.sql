-- Retirada do array legado depois da conversão para `papel`.
-- `dadosPessoais` permanece até a transformação relacional posterior, que
-- depende da carga explícita das referências acadêmicas.
ALTER TABLE `usuarios` DROP COLUMN `papeis`;
