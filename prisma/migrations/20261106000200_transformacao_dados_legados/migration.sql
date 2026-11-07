-- Converte o cargo legado (array JSON) em valor escalar. Linhas com zero,
-- múltiplos ou valores inválidos permanecem NULL e fazem a alteração final
-- falhar, exigindo decisão explícita antes de retirar o campo legado.
UPDATE `usuarios`
SET `papel` = CASE
    WHEN JSON_LENGTH(`papeis`) = 1
     AND JSON_UNQUOTE(JSON_EXTRACT(`papeis`, '$[0]')) IN (
        'aluno',
        'coordenador_curso',
        'coordenador_estagio',
        'administrador'
     )
    THEN JSON_UNQUOTE(JSON_EXTRACT(`papeis`, '$[0]'))
    ELSE NULL
END;

ALTER TABLE `usuarios` MODIFY `papel` VARCHAR(30) NOT NULL DEFAULT 'aluno';

UPDATE `usuarios`
SET `atualizadoEm` = `criadoEm`
WHERE `atualizadoEm` IS NULL;

ALTER TABLE `usuarios` MODIFY `atualizadoEm` DATETIME(3) NOT NULL;
