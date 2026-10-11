import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O Playwright acessa o servidor de desenvolvimento por 127.0.0.1, enquanto o
   * `next dev` escuta em localhost. Sem esta lista, o Next bloqueia os recursos
   * de HMR (e a hidratação do cliente) por origem cruzada.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /**
   * O cliente Prisma 7 roda com o driver adapter do MySQL (`mariadb`), que abre
   * sockets TCP e não deve ser empacotado pelo bundler. Mantê-los externos evita
   * que o build tente resolver módulos nativos/dinâmicos do driver.
   */
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb"],

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
