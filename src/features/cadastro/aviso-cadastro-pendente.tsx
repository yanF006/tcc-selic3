import { AlertCircleIcon, ClockIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { sairAction } from "@/app/(publico)/acoes/sessao";

/**
 * Aviso do cadastro pendente (5.7). A pessoa entra no sistema, mas não enxerga
 * nenhum dado: nem documentos, nem estágios, nem horas. A liberação depende da
 * decisão da coordenação na fila de solicitações.
 */
export function AvisoCadastroPendente({ nome }: { nome: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">Cadastro aguardando autorização</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <ClockIcon aria-hidden="true" />
            <AlertTitle>Aguarde a coordenação</AlertTitle>
            <AlertDescription>
              A matrícula de {nome} ainda não foi autorizada pela coordenação de estágio. Nenhum
              dado do sistema fica disponível até a liberação.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Por que o acesso está bloqueado?</AlertTitle>
            <AlertDescription>
              Sua matrícula não consta nos registros importados do SIGAA. Depois da decisão da
              coordenação, o acesso é liberado automaticamente e você recebe um aviso.
            </AlertDescription>
          </Alert>

          <p className="text-muted-foreground text-sm">
            Se a matrícula estiver correta e a autorização não vier, procure a coordenação do campus
            Pinheiral.
          </p>

          <form action={sairAction}>
            <Button className="w-fit" variant="outline" type="submit">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
