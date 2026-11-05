# Auditoria das listas persistidas

Levantamento da tarefa 3.2. Listas com dados persistidos no banco quando
`DATABASE_URL` está configurada e seus limites antes/depois da correção.

| Lista | Origem | Antes | Depois | Cobertura |
| --- | --- | --- | --- | --- |
| Usuários (`/admin/usuarios`) | `prisma.usuario.findMany` + filtros na página | Consulta limitada a 50 e filtro/paginação sobre o recorte carregado | Busca, filtros e paginação em `searchParams` sobre o conjunto completo; 10 por página | E2E `e2e/usuarios.spec.ts` (filtros e cadastro fora da primeira página) e teste de serviço que encontra o 55º cadastro por busca |
| Matrículas (`/admin/matriculas`) | `prisma.matriculaImportada.findMany` + filtros na página | Consulta limitada a 100 e filtro/paginação sobre o recorte carregado | Busca, origem e paginação em `searchParams` sobre o conjunto completo; 10 por página | E2E de matrículas/importação e teste de serviço `pagina as matrículas pelo conjunto completo` |

As demais listas da aplicação (solicitações, estágios, convênios, documentos,
estatísticas e afins) continuam baseadas nas fixtures locais em modo de
simulação e não consultam o banco; portanto, não possuem recorte silencioso de
registros persistidos. Se alguma passar a persistir, deve seguir o mesmo
contrato: consulta completa no servidor, filtros/paginação via URL e teste com
um registro fora da primeira página.
