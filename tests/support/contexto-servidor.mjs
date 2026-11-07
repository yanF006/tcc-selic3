import { registerHooks } from "node:module";

// Em produção o Next resolve este marcador. Processos Node de integração usam
// o mesmo módulo vazio que o Vitest, sem alterar a resolução da aplicação.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return nextResolve(new URL("./server-only.cjs", import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
