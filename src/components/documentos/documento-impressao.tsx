import { DocumentPreview } from "@/components/documentos/document-preview";
import type { CampoDescriptor, DescriptorDocumento } from "@/lib/templates/descriptors";
import { valoresLegiveis } from "@/lib/templates/valores-legiveis";

/**
 * Folha de impressão de um documento preenchido (8.13). Recebe os valores já
 * prontos e desenha o documento dentro do escopo de tokens de impressão (2.5),
 * em campos estáticos — nada de formulário, foco ou máscara —, para que a
 * página dedicada imprima apenas o documento, sem a interface ao redor.
 */

const CLASSIFICACAO_IDENTIFICACAO = "Identificação do documento";

function CampoImpressao({ campo, valor }: { campo: CampoDescriptor; valor: string }) {
  if (campo.tipo === "instrucao") return null;

  return (
    <div className="flex flex-col gap-0.5 border-b border-neutral-300 pb-1">
      <dt className="text-[0.7rem] font-medium text-neutral-500 uppercase">{campo.rotulo}</dt>
      <dd className="text-sm text-neutral-900">{valor}</dd>
    </div>
  );
}

function SecaoImpressao({
  titulo,
  descricao,
  campos,
  valores,
}: {
  titulo: string;
  descricao?: string;
  campos: CampoDescriptor[];
  valores: Record<string, string>;
}) {
  const exibiveis = campos.filter((campo) => campo.tipo !== "instrucao");

  if (exibiveis.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{titulo}</h2>
        {descricao ? <p className="text-xs text-neutral-500">{descricao}</p> : null}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {exibiveis.map((campo) => (
          <CampoImpressao key={campo.id} campo={campo} valor={valores[campo.id] ?? "—"} />
        ))}
      </dl>
    </section>
  );
}

export function DocumentoImpressao({
  descriptor,
  valores,
}: {
  descriptor: DescriptorDocumento;
  valores: Record<string, unknown>;
}) {
  const legiveis = valoresLegiveis(descriptor, valores);
  const automaticos = descriptor.auto ?? [];

  return (
    <DocumentPreview titulo={descriptor.titulo}>
      <article className="flex flex-col gap-6 text-neutral-900">
        <header className="flex flex-col gap-1 border-b border-neutral-400 pb-4 text-center">
          <p className="text-xs font-semibold tracking-wide uppercase">
            Sistema de Estágios das Licenciaturas — SELic
          </p>
          <h1 className="text-lg font-semibold">{descriptor.titulo}</h1>
          {descriptor.descricao ? (
            <p className="text-xs text-neutral-500">{descriptor.descricao}</p>
          ) : null}
        </header>

        {automaticos.length > 0 ? (
          <SecaoImpressao
            titulo={CLASSIFICACAO_IDENTIFICACAO}
            campos={automaticos}
            valores={legiveis}
          />
        ) : null}

        {descriptor.secoes.map((secao) => (
          <SecaoImpressao
            key={secao.id}
            titulo={secao.titulo}
            descricao={secao.descricao}
            campos={secao.campos}
            valores={legiveis}
          />
        ))}

        {descriptor.observacao ? (
          <footer className="border-t border-neutral-300 pt-3">
            <p className="text-xs text-neutral-500">{descriptor.observacao}</p>
          </footer>
        ) : null}
      </article>
    </DocumentPreview>
  );
}
