import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O Playwright acessa o servidor de desenvolvimento por 127.0.0.1, enquanto o
   * `next dev` escuta em localhost. Sem esta lista, o Next bloqueia os recursos
   * de HMR (e a hidratação do cliente) por origem cruzada.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  /**
   * Diretório de build separado para os servidores que os E2E de reinício
   * sobem por conta própria: dois `next dev` do mesmo projeto não podem
   * compartilhar `.next`. Só é definido quando o teste pede explicitamente;
   * fora disso o Next usa o padrão.
   */
  ...(process.env.SELIC_DIST_DIR ? { distDir: process.env.SELIC_DIST_DIR } : {}),

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
