import { esquemaCep } from "@/lib/domain/schemas";
import { consultarViaCep } from "@/lib/services/viacep-servidor";

export async function GET(requisicao: Request) {
  const cep = esquemaCep.safeParse(new URL(requisicao.url).searchParams.get("cep"));
  const resultado = cep.success
    ? await consultarViaCep(cep.data, requisicao.signal)
    : { status: "invalido" as const };
  return Response.json(resultado, {
    status: resultado.status === "invalido" ? 400 : resultado.status === "indisponivel" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
