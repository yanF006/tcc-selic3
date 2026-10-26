"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  registrarVersaoAction,
  alterarTemplateAction,
} from "@/app/(coordenacao)/coordenacao/templates/acoes";
import {
  camposDoTemplate,
  fonteParecer,
  FONTES_ALUNO,
  FONTES_ESTAGIO,
  type CampoDescriptor,
  type OrigemCampo,
  type RegraValidacao,
  type TipoCampoDescriptor,
} from "@/lib/templates/descriptors";
import type { templatesParaGestao } from "@/lib/services/templates";
import { MASCARAS, type NomeMascara } from "@/lib/mask";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatarData } from "@/lib/format";

const tipos: TipoCampoDescriptor[] = [
  "texto",
  "textarea",
  "numero",
  "data",
  "hora",
  "select",
  "radio",
  "checkbox",
  "arquivo",
  "assinatura",
  "grade",
  "auto",
  "fixo",
  "instrucao",
];
const regras: RegraValidacao[] = [
  "cpf",
  "rg",
  "email",
  "telefone",
  "celular",
  "cep",
  "data",
  "hora",
  "intervalo_datas",
  "numero",
  "limite_palavras",
];

export function GestaoTemplates({
  templates,
}: {
  templates: Awaited<ReturnType<typeof templatesParaGestao>>;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((registro) => registro.id === templateId);
  const [campos, setCampos] = useState<CampoDescriptor[]>(() =>
    templates[0] ? camposDoTemplate(templates[0].id, templates[0].descritor) : [],
  );
  const [mensagem, setMensagem] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  function mudarCampo(indice: number, alteracoes: Partial<CampoDescriptor>) {
    setCampos((atuais) =>
      atuais.map((campo, posicao) => {
        if (posicao !== indice) return campo;
        const parecer = Object.hasOwn(alteracoes, "parecer")
          ? alteracoes.parecer
          : fonteParecer(templateId, campo);
        const novo = {
          ...campo,
          fonte:
            campo.fonte ||
            (campo.origem === "aluno" || campo.origem === "estagio" ? campo.id : undefined),
          ...alteracoes,
          parecer,
        };
        if (parecer) {
          novo.origem = "digitado";
          novo.fonte = undefined;
        } else if (novo.origem === "aluno")
          novo.fonte = FONTES_ALUNO.includes(novo.fonte ?? "") ? novo.fonte : "nomeCompleto";
        else if (novo.origem === "estagio")
          novo.fonte = FONTES_ESTAGIO.includes(novo.fonte ?? "") ? novo.fonte : "instituicao";
        else novo.fonte = undefined;
        if (alteracoes.origem !== undefined)
          novo.somenteLeitura = novo.origem === "aluno" || novo.origem === "estagio";
        return novo;
      }),
    );
  }
  function operar(operacao: "inativar" | "ativar" | "excluir") {
    if (
      operacao === "excluir" &&
      !window.confirm("Excluir o template? Templates com documentos gerados devem ser inativados.")
    )
      return;
    iniciar(async () => {
      const resultado = await alterarTemplateAction(templateId, operacao);
      setMensagem(resultado);
      if (resultado.ok) router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-gerenciado">Documento do template</Label>
        <select
          id="template-gerenciado"
          className="bg-background rounded border p-2"
          value={templateId}
          onChange={(evento) => {
            const selecionado = templates.find((registro) => registro.id === evento.target.value)!;
            setTemplateId(selecionado.id);
            setCampos(camposDoTemplate(selecionado.id, selecionado.descritor));
            setMensagem(null);
          }}
        >
          {templates.map((registro) => (
            <option key={registro.id} value={registro.id}>
              {registro.nome}
            </option>
          ))}
        </select>
      </div>
      {mensagem && (
        <Alert variant={mensagem.ok ? "default" : "destructive"}>
          <AlertTitle>{mensagem.ok ? "Operação concluída" : "Operação recusada"}</AlertTitle>
          <AlertDescription>{mensagem.mensagem}</AlertDescription>
        </Alert>
      )}
      {template && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Histórico de versões</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Badge variant={template.situacao === "ativo" ? "success" : "secondary"}>
                {template.situacao === "ativo" ? "Template ativo" : "Template inativo"}
              </Badge>
              <p>{template.totalDocumentos} documentos gerados.</p>
              <ul className="flex flex-col gap-2">
                {template.versoes.map((versao) => (
                  <li key={versao.versao}>
                    Versão {versao.versao} — {versao.vigente ? "vigente" : "histórica"} ·{" "}
                    {versao.arquivo.split(/[\\/]/).at(-1)} · {formatarData(versao.registradaEm)}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pendente}
                  onClick={() => operar(template.situacao === "ativo" ? "inativar" : "ativar")}
                >
                  {template.situacao === "ativo" ? "Inativar template" : "Ativar template"}
                </Button>
                <Button variant="destructive" disabled={pendente} onClick={() => operar("excluir")}>
                  Excluir template
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/documentos/${templateId}`}>Consultar preenchimento</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Nova versão do template</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  const formulario = new FormData(evento.currentTarget);
                  iniciar(async () => {
                    const resultado = await registrarVersaoAction(templateId, campos, formulario);
                    setMensagem(resultado);
                    if (resultado.ok) router.refresh();
                  });
                }}
              >
                <Label htmlFor="arquivo-template">Arquivo .docx do template</Label>
                <Input
                  key={templateId}
                  id="arquivo-template"
                  name="arquivo"
                  type="file"
                  accept=".docx"
                  required
                />
                <p className="text-muted-foreground text-sm">
                  Defina os campos correspondentes ao arquivo. A nova versão será usada somente em
                  novos documentos; os preenchimentos anteriores conservam sua versão.
                </p>
                {campos.map((campo, indice) => (
                  <details
                    className="rounded border p-3"
                    key={indice}
                    data-testid={`campo-template-${campo.id}`}
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {campo.rotulo} · {campo.id}
                    </summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`chave-${indice}`}>Chave do campo</Label>
                        <Input
                          id={`chave-${indice}`}
                          value={campo.id}
                          onChange={(evento) => mudarCampo(indice, { id: evento.target.value })}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`rotulo-${indice}`}>Rótulo do campo</Label>
                        <Input
                          id={`rotulo-${indice}`}
                          value={campo.rotulo}
                          onChange={(evento) => mudarCampo(indice, { rotulo: evento.target.value })}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`tipo-${indice}`}>Tipo do campo</Label>
                        <select
                          id={`tipo-${indice}`}
                          className="bg-background rounded border p-2"
                          value={campo.tipo}
                          onChange={(evento) =>
                            mudarCampo(indice, { tipo: evento.target.value as TipoCampoDescriptor })
                          }
                        >
                          {tipos.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {tipo}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`origem-${indice}`}>Origem do valor</Label>
                        <select
                          id={`origem-${indice}`}
                          className="bg-background rounded border p-2"
                          value={campo.origem}
                          onChange={(evento) =>
                            mudarCampo(indice, { origem: evento.target.value as OrigemCampo })
                          }
                        >
                          {["digitado", "aluno", "estagio", "literal"].map((origem) => (
                            <option key={origem} value={origem}>
                              {origem}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(campo.origem === "aluno" || campo.origem === "estagio") && (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`fonte-${indice}`}>
                            Dado para preenchimento automático
                          </Label>
                          <select
                            className="bg-background rounded border p-2"
                            id={`fonte-${indice}`}
                            value={campo.fonte || campo.id}
                            onChange={(evento) =>
                              mudarCampo(indice, { fonte: evento.target.value })
                            }
                          >
                            {(campo.origem === "aluno" ? FONTES_ALUNO : FONTES_ESTAGIO).map(
                              (fonte) => (
                                <option key={fonte} value={fonte}>
                                  {fonte}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`parecer-${indice}`}>
                          Preenchimento pela coordenação no parecer
                        </Label>
                        <select
                          id={`parecer-${indice}`}
                          className="bg-background rounded border p-2"
                          value={fonteParecer(templateId, campo) ?? ""}
                          onChange={(evento) =>
                            mudarCampo(indice, {
                              parecer: (evento.target.value ||
                                undefined) as CampoDescriptor["parecer"],
                            })
                          }
                        >
                          <option value="">Não se aplica</option>
                          <option value="decisao">Decisão</option>
                          <option value="consideracoes">Considerações</option>
                          <option value="data">Data do parecer</option>
                        </select>
                      </div>
                      <Label className="flex items-center gap-2">
                        <Checkbox
                          checked={campo.obrigatorio === true}
                          onCheckedChange={(valor) =>
                            mudarCampo(indice, { obrigatorio: valor === true })
                          }
                        />
                        Campo obrigatório
                      </Label>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`mascara-${indice}`}>Máscara</Label>
                        <select
                          id={`mascara-${indice}`}
                          className="bg-background rounded border p-2"
                          value={campo.mascara ?? ""}
                          onChange={(evento) =>
                            mudarCampo(indice, {
                              mascara: (evento.target.value || undefined) as
                                NomeMascara | undefined,
                            })
                          }
                        >
                          <option value="">Sem máscara</option>
                          {Object.keys(MASCARAS).map((valor) => (
                            <option key={valor} value={valor}>
                              {valor}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`limite-${indice}`}>Limite de palavras</Label>
                        <Input
                          id={`limite-${indice}`}
                          type="number"
                          min={1}
                          value={campo.maximoPalavras ?? ""}
                          onChange={(evento) =>
                            mudarCampo(indice, {
                              maximoPalavras: evento.target.value
                                ? Number(evento.target.value)
                                : undefined,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`ajuda-${indice}`}>Texto de apoio ou instrução</Label>
                        <Textarea
                          id={`ajuda-${indice}`}
                          value={campo.ajuda ?? ""}
                          onChange={(evento) => mudarCampo(indice, { ajuda: evento.target.value })}
                        />
                      </div>
                      {(campo.tipo === "select" || campo.tipo === "radio") && (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`opcoes-${indice}`}>
                            Opções: valor|rótulo, uma por linha
                          </Label>
                          <Textarea
                            id={`opcoes-${indice}`}
                            value={(campo.opcoes ?? [])
                              .map((opcao) => `${opcao.valor}|${opcao.rotulo}`)
                              .join("\n")}
                            onChange={(evento) =>
                              mudarCampo(indice, {
                                opcoes: evento.target.value
                                  .split("\n")
                                  .filter(Boolean)
                                  .map((linha) => {
                                    const [valor, ...rotulo] = linha.split("|");
                                    return { valor, rotulo: rotulo.join("|") || valor };
                                  }),
                              })
                            }
                          />
                        </div>
                      )}
                      {campo.tipo === "grade" && (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`colunas-${indice}`}>
                            Colunas: chave|rótulo|tipo, uma por linha
                          </Label>
                          <Textarea
                            id={`colunas-${indice}`}
                            value={(campo.colunas ?? [])
                              .map((coluna) => `${coluna.chave}|${coluna.rotulo}|${coluna.tipo}`)
                              .join("\n")}
                            onChange={(evento) =>
                              mudarCampo(indice, {
                                colunas: evento.target.value
                                  .split("\n")
                                  .filter(Boolean)
                                  .map((linha) => {
                                    const [chave, rotulo, tipo] = linha.split("|");
                                    return {
                                      chave,
                                      rotulo,
                                      tipo: tipo as "texto" | "data" | "hora" | "numero",
                                    };
                                  }),
                              })
                            }
                          />
                        </div>
                      )}
                      <fieldset className="flex flex-wrap gap-3 sm:col-span-2">
                        <legend className="mb-2 text-sm font-medium">Validações</legend>
                        {regras.map((regra) => (
                          <Label key={regra} className="flex items-center gap-2">
                            <Checkbox
                              checked={campo.validacao?.includes(regra) === true}
                              onCheckedChange={(valor) =>
                                mudarCampo(indice, {
                                  validacao:
                                    valor === true
                                      ? [...(campo.validacao ?? []), regra]
                                      : (campo.validacao ?? []).filter((atual) => atual !== regra),
                                })
                              }
                            />
                            {regra}
                          </Label>
                        ))}
                      </fieldset>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          setCampos((atuais) => atuais.filter((_, posicao) => posicao !== indice))
                        }
                      >
                        Remover campo
                      </Button>
                    </div>
                  </details>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      let indice = campos.length + 1;
                      while (campos.some((campo) => campo.id === `novo_campo_${indice}`)) indice++;
                      setCampos([
                        ...campos,
                        {
                          id: `novo_campo_${indice}`,
                          rotulo: "Novo campo",
                          tipo: "texto",
                          origem: "digitado",
                          obrigatorio: false,
                        },
                      ]);
                    }}
                  >
                    Adicionar campo
                  </Button>
                  <Button type="submit" disabled={pendente}>
                    Cadastrar nova versão
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
