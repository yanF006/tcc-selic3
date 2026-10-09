import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O Playwright acessa o servidor de desenvolvimento por 127.0.0.1, enquanto o
   * `next dev` escuta em localhost. Sem esta lista, o Next bloqueia os recursos
   * de HMR (e a hidratação do cliente) por origem cruzada.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /**
   * Os documentos do Kit de Estágio ficam em `Contexto/kit-estagio` e são lidos
   * por `fs` na rota de download, então o tracing automático não os enxerga.
   * A inclusão explícita garante que o Preview na Vercel sirva o arquivo.
   */
  outputFileTracingIncludes: {
    "/documentos/*/baixar": ["./Contexto/kit-estagio/**/*"],
  },
};

export default nextConfig;
