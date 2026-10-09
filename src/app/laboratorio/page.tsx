"use client";

import * as React from "react";

import { DocumentPreview } from "@/components/documentos/document-preview";
import { LaboratorioFormulario } from "@/components/documentos/laboratorio-formulario";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/**
 * Página de laboratório: renderiza os componentes base para conferência
 * visual de tema, foco e contraste. Não faz parte do fluxo do sistema.
 */
export default function PaginaLaboratorio() {
  const [aberto, setAberto] = React.useState(false);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-6">
          <Logo tamanho="grande" />
          <Logo tamanho="medio" />
          <Logo tamanho="pequeno" />
        </div>
        <ThemeToggle />
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <Button>Padrão</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="destructive">Destrutivo</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Pequeno</Button>
        <Button size="lg">Grande</Button>
        <Button size="icon" aria-label="Ícone">
          +
        </Button>
        <Button disabled>Desabilitado</Button>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {(
          [
            ["default", "Padrão"],
            ["secondary", "Secundário"],
            ["destructive", "Erro"],
            ["success", "Sucesso"],
            ["warning", "Aviso"],
            ["info", "Informação"],
            ["outline", "Contorno"],
            ["neutro", "Neutro"],
          ] as const
        ).map(([variante, rotulo]) => (
          <Badge key={variante} variant={variante}>
            {rotulo}
          </Badge>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campos</CardTitle>
            <CardDescription>Estados de foco, erro e desabilitado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lab-nome">Nome completo</Label>
              <Input id="lab-nome" placeholder="Maria de Souza" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lab-email">E-mail</Label>
              <Input id="lab-email" type="email" placeholder="maria@exemplo.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lab-erro">CPF</Label>
              <Input id="lab-erro" aria-invalid defaultValue="123" />
              <p className="text-destructive text-sm font-medium">CPF inválido.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lab-obs">Observações</Label>
              <Textarea id="lab-obs" rows={3} placeholder="Anotações do aluno" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lab-curso">Curso</Label>
              <Select defaultValue="ads">
                <SelectTrigger id="lab-curso" className="w-full">
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ads">Análise e Desenvolvimento de Sistemas</SelectItem>
                  <SelectItem value="eletro">Eletricidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked /> Comprovante
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch /> Receber avisos
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas e diálogos</CardTitle>
            <CardDescription>Feedback de sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="success">
              <AlertTitle>Documento submetido</AlertTitle>
              <AlertDescription>O parecer do coordenador foi solicitado.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Horas excedidas</AlertTitle>
              <AlertDescription>O limite de 6 horas por dia foi atingido.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Falha no envio</AlertTitle>
              <AlertDescription>
                O e-mail do responsável externo está indisponível.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogTrigger asChild>
                  <Button variant="outline">Abrir diálogo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Remover documento</DialogTitle>
                    <DialogDescription>
                      O documento será inativado e continua visível para a coordenação.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="destructive">Inativar</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem>Inativar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Abas, tabela e progresso</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
              <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
            </TabsList>
            <TabsContent value="pendentes">Conteúdo de pendentes.</TabsContent>
            <TabsContent value="concluidos">Conteúdo de concluídos.</TabsContent>
          </Tabs>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Total de horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Termo de Compromisso</TableCell>
                <TableCell>
                  <Badge variant="info">Em análise</Badge>
                </TableCell>
                <TableCell>120h</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ficha de Frequência</TableCell>
                <TableCell>
                  <Badge variant="success">Aprovado</Badge>
                </TableCell>
                <TableCell>120h</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">Aproveitamento de horas: 80%</p>
            <Progress value={80} />
          </div>
          <Separator />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Formulário dirigido pelo descritor
          </h2>
          <p className="text-muted-foreground text-sm">
            Um exemplo de cada tipo de campo do Kit (8.5): texto, texto com máscara, área de texto
            com limite de palavras, número, data, hora, seleção, escolha única, marcação, grade
            repetível, assinatura, campo automático, texto fixo e instrução.
          </p>
        </div>

        <LaboratorioFormulario />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Campos automáticos com pendência
          </h2>
          <p className="text-muted-foreground text-sm">
            Quando um campo automático obrigatório não existe no cadastro, o formulário exibe a
            mensagem de pendência com o link para completar o cadastro (8.7).
          </p>
        </div>

        <div className="border rounded-md p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label>Campo automático (sem dado no cadastro)</Label>
              <p className="border-input bg-muted/40 text-foreground flex min-h-9 w-full items-center rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">—</span>
              </p>
              <p className="text-warning flex items-start gap-1 text-xs">
                <span>Pendência: este dado não consta no seu cadastro. </span>
                <a className="underline underline-offset-4" href="/perfil">
                  Complete o cadastro
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Preview de documento</h2>
          <p className="text-muted-foreground text-sm">
            A folha abaixo fica em fundo claro nos dois temas. Use o botão para imprimir: a barra de
            ações sai e o documento sai branco com texto preto.
          </p>
        </div>

        <div className="sem-impressao flex justify-end">
          <Button variant="outline" onClick={() => window.print()}>
            Imprimir documento
          </Button>
        </div>

        <DocumentPreview
          titulo="Termo de Compromisso de Estágio"
          className="bg-muted/40 rounded-md"
        >
          <header className="flex flex-col gap-1 border-b pb-4">
            <p className="text-center text-sm font-semibold uppercase">
              Sistema de Gestão de Estágio — SELic
            </p>
            <h3 className="text-center text-base font-semibold">Termo de Compromisso de Estágio</h3>
          </header>
          <div className="flex flex-col gap-3 pt-4">
            <p>
              Eu, <span className="font-medium">Maria de Souza</span>, matriculado no curso de
              Análise e Desenvolvimento de Sistemas, turma 2024.1, declaro que firmo este termo com
              a instituição <span className="font-medium">Instituto Federal do Rio de Janeiro</span>
              .
            </p>
            <div className="flex flex-col gap-1">
              <p>
                Duração prevista: <span className="font-medium">120 horas</span>.
              </p>
              <p>
                Período: <span className="font-medium">01/03/2026 a 30/11/2026</span>.
              </p>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">Supervisor</th>
                  <th className="border px-2 py-1 text-left">Orientador</th>
                  <th className="border px-2 py-1 text-left">Situação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">João Batista</td>
                  <td className="border px-2 py-1">Ana Paula Moreira</td>
                  <td className="border px-2 py-1">
                    <Badge variant="info">Em análise</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs">
              Documento de demonstração do escopo de impressão: o conteúdo acima é preenchido pelo
              descritor do template.
            </p>
          </div>
        </DocumentPreview>
      </section>
    </main>
  );
}
