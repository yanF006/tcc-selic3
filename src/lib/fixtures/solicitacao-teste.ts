/** Entrada completa de uma solicitação usada exclusivamente pelos testes. */
export function dadosSolicitacaoTeste() {
  return {
    convenioId: "conv-ti-pinheiral",
    supervisorId: "sup-ricardo",
    orientadorId: "ori-carla",
    dataInicio: "2027-01-04",
    dataFim: "2027-01-29",
    cargaHorariaPrevista: 120,
    valoresDocumentos: {
      "tpl-formulario-liberacao": {
        telefoneAluno: "2133337788",
        celularAluno: "21998761234",
        emailAluno: "maria.souza@aluno.ifrj.edu.br",
        enderecoLocal: "Rua da Empresa, 10",
        telefoneSupervisor: "2133331000",
      },
      "tpl-termo-compromisso": {
        cnpj: "11222333000181",
        responsavel: "Marina Duarte",
        nomeDiretor: "Heider Alves Franco",
        logradouro: "Rua da Empresa",
        numero: "10",
        bairro: "Centro",
        cidade: "Pinheiral",
        estado: "RJ",
        cep: "23940000",
        seguradora: "Seguradora",
        numeroApolice: "AP-120",
        cargaHorariaSemanal: 30,
        horario: "09:00 às 15:00",
      },
      "tpl-plano-atividades": {
        tipoAtividade: "estagio",
        dataInicioPrevista: "04/01/2027",
        dataFimPrevista: "29/01/2027",
        atividades: "Apoio às atividades de ensino e desenvolvimento de sistemas.",
      },
    },
  };
}
