"use client";

import { useRef, useState } from "react";
import { LIMITE_ARQUIVO_BYTES, type FinalidadeArquivo, type MetadadosArquivo } from "@/lib/domain/arquivos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AnexosDocumento({ documentoId, arquivosIniciais, podeAnexar, comprovantesPermitidos }: {
  documentoId: string; arquivosIniciais: MetadadosArquivo[]; podeAnexar: boolean; comprovantesPermitidos: boolean;
}) {
  const [novosArquivos, setNovosArquivos] = useState<MetadadosArquivo[]>([]);
  const arquivos = [...novosArquivos, ...arquivosIniciais].filter((item, indice, todos) => todos.findIndex((outro) => outro.id === item.id) === indice);
  const [finalidade, setFinalidade] = useState<FinalidadeArquivo>(comprovantesPermitidos ? "comprovante" : "assinado");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const emAndamento = useRef(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (emAndamento.current) return;
    if (!arquivo) { setMensagem({ erro: true, texto: "Selecione um arquivo." }); return; }
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) { setMensagem({ erro: true, texto: "O limite por arquivo é de 4 MiB." }); return; }
    emAndamento.current = true;
    setEnviando(true);
    setMensagem(null);
    try {
      const resposta = await fetch(`/api/documentos/${encodeURIComponent(documentoId)}/arquivos`, {
        method: "POST", body: arquivo,
        headers: { "content-type": arquivo.type || "application/octet-stream", "x-arquivo-nome": encodeURIComponent(arquivo.name), "x-arquivo-finalidade": finalidade },
      });
      const resultado = await resposta.json();
      if (!resposta.ok) { setMensagem({ erro: true, texto: resultado.erro ?? "Não foi possível anexar o arquivo." }); return; }
      setNovosArquivos((atuais) => [resultado.arquivo as MetadadosArquivo, ...atuais]);
      setArquivo(null);
      if (entrada.current) entrada.current.value = "";
      setMensagem({ erro: false, texto: "Arquivo salvo." });
    } catch {
      setMensagem({ erro: true, texto: "Não foi possível confirmar o envio. Atualize a lista antes de tentar novamente." });
    } finally { setEnviando(false); emAndamento.current = false; }
  }

  return (
    <Card className="sem-impressao mt-6">
      <CardHeader><CardTitle className="text-base">Arquivos recebidos e comprovantes</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">Até 4 MiB por arquivo. Documentos assinados: PDF. Comprovantes: PDF, JPEG ou PNG. Anexar um arquivo não confirma assinaturas nem libera o estágio.</p>
        {mensagem && <Alert variant={mensagem.erro ? "destructive" : "default"} role={mensagem.erro ? "alert" : "status"}><AlertDescription>{mensagem.texto}</AlertDescription></Alert>}
        {podeAnexar && <form onSubmit={enviar}>
          <fieldset disabled={enviando} className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="finalidade-anexo">Finalidade do arquivo</Label>
                <select id="finalidade-anexo" className="bg-background rounded border p-2" value={finalidade} onChange={(evento) => {
                  setFinalidade(evento.target.value as FinalidadeArquivo); setArquivo(null);
                  if (entrada.current) entrada.current.value = "";
                }}>
                  {comprovantesPermitidos && <option value="comprovante">Comprovante</option>}
                  <option value="assinado">Documento recebido assinado</option>
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="arquivo-anexo">Arquivo (até 4 MiB)</Label>
                <Input ref={entrada} id="arquivo-anexo" type="file" required accept={finalidade === "assinado" ? ".pdf,application/pdf" : ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"} onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)} />
              </div>
            </div>
            <Button type="submit" className="self-start" disabled={enviando}>{enviando ? "Enviando…" : "Anexar arquivo"}</Button>
          </fieldset>
        </form>}
        {arquivos.length ? <ul className="flex flex-col gap-3">
          {arquivos.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
            <div className="min-w-0"><p className="text-sm font-medium break-all">{item.nome}</p><p className="text-muted-foreground text-xs">{item.finalidade === "assinado" ? "Documento recebido assinado" : "Comprovante"} · {(item.tamanhoBytes / 1024).toFixed(1)} KiB</p></div>
            <Button asChild variant="outline" size="sm"><a href={`/api/arquivos/${encodeURIComponent(item.id)}`}>Baixar <span className="sr-only">{item.nome}</span></a></Button>
          </li>)}
        </ul> : <p className="text-muted-foreground text-sm">Nenhum arquivo anexado.</p>}
      </CardContent>
    </Card>
  );
}
