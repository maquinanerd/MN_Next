# 3. Migração WordPress, mídia, slugs e redirects

## Princípios

WordPress é uma origem de leitura. Nunca altere posts, mídia, redirecionamentos ou plugins no WP. Todo comando de produção precisa de uma variável explícita e uma flag `--apply`; sem ela, é dry-run. A migração é reexecutável: uma segunda execução não cria artigos, taxonomias, assets ou redirects duplicados.

## Inventário obrigatório

Produza `artifacts/migration/inventory.json` e um resumo Markdown com: padrão real de permalink, posts por status/tipo, categorias/tags/autores, campos customizados, tamanho/formato de mídia, HTML/shortcodes/embeds/tabelas/galerias, URLs mais acessadas e URLs 404. Se Search Console/Analytics não estiverem disponíveis, aceite CSVs em `data/import/` e marque essa lacuna; não bloqueie o restante.

## Pipeline idempotente

1. **Extrair:** WP REST API ou WXR export em paginação, com raw response arquivado fora do git. Possuir `--since`, `--limit`, `--resume` e rate-limit.
2. **Normalizar:** mapear IDs WP, status, timezone, slugs, autores, taxonomias, SEO e imagem destacada. Não gerar novo slug se um legado existe.
3. **Sanitizar/converter:** usar parser DOM server-side; allowlist de tags/atributos/URLs. Converter HTML para `ContentBlock[]`; remover scripts/event handlers/iframes não aprovados; converter embeds reconhecidos; produzir `unknown-blocks.ndjson` com post/trecho/tipo em vez de descartar conteúdo.
4. **Mídia:** deduplicar por checksum ou URL origem, baixar com tamanho/tipo máximos, detectar dimensões, enviar ao Kal El, preservar alt/legenda/crédito e registrar `wpMediaId → kalElMediaId`. Rejeitar SVG não sanitizado e arquivos executáveis. Gerar `blurDataURL` se o CMS não entrega um.
5. **Upsert:** enviar taxonomias/autores, mídia, artigos, especiais/comercial e redirects por ID de origem + idempotency key. Persistir checkpoint por lote e relatório.
6. **Verificar:** buscar amostra de destino, comparar título/slug/blocos/mídia, executar importação de novo e provar zero duplicação.

## Formato de estado (não versionar produção)

```json
{
  "runId": "uuid", "source": "wordpress", "startedAt": "ISO-8601",
  "cursor": 123, "counts": { "read": 0, "created": 0, "updated": 0, "skipped": 0, "failed": 0 },
  "mappings": { "wpPostId:123": "kalelArticleId" }, "failures": []
}
```

Usar SQLite/JSON local ignorado ou storage definido pelo operador para checkpoints. Nunca colocar conteúdo/senhas em logs; emitir IDs e URLs sanitizadas.

## Redirects e compatibilidade

- A tabela/módulo `legacy_redirects` contém `fromPath`, `toPath`, `status`, `source`, `createdAt`. Apenas paths relativos, normalizados e sem redirect aberto.
- Mapear cada permalink WP para a URL equivalente. Redirecionar 301 todo conteúdo existente e 410 apenas remoção editorial deliberada. Preservar query parameters de tracking permitidos; tratar `/feed`, `/comments/feed`, `/wp-json`, anexos e `?p=ID` explicitamente.
- Middleware verifica regras estáticas/edge-safe; se a origem requer I/O, gerar mapa compilado/edge cache ou resolver antes no CDN. Rota canônica não pode entrar em loop.
- Criar testes com 1.000 URLs de tráfego (ou a maior amostra disponível). Critério de lançamento: zero 404 acidental, zero loop, status e destino corretos.

## Ferramentas a criar

```
scripts/wp/export.ts             lê REST/WXR, com dry-run/resume
scripts/wp/transform.ts          HTML → ContentBlock[] + relatório
scripts/wp/media.ts              transferência, validação e dedupe
scripts/wp/import.ts             orquestra upserts e checkpoints
scripts/wp/build-redirects.ts    gera regras/matriz de validação
scripts/wp/verify.ts             compara origem/destino e URLs
```

Todos devem ter `--help`, retorno não-zero em falha, summary estruturado e testes de unidade. Incluir fixtures de WordPress: shortcode desconhecido, iframe permitido/não permitido, galeria, tabela, imagem sem alt, post com slug duplicado e post atualizado.
