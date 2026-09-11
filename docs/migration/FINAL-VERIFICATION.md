# Verificação final — rodada do kit de front-end

Resultados **reais**, obtidos executando os comandos listados em 2026-09-10. O que não pôde
ser verificado está nas pendências, não marcado como feito. A verificação das rodadas
anteriores (migração WordPress, integração Kal El, seis ciclos de revisão) está no
histórico do git, na versão deste arquivo do commit `41d79d6`; o que ela provou continua
coberto pelos mesmos testes, que seguem na suíte.

- **Branch:** `claude/frontend-analysis-publish-1f27fe`
- **Ambiente:** Windows 11, Node 24, pnpm 11, Next 15.5.4, Tailwind 4.1.13
- **Modo:** `APP_ENV=test`, `CONTENT_SOURCE=fixture` (Playwright) e `CONTENT_SOURCE=kalel`
  contra o CMS de contrato (`pnpm test:kalel`)

---

## 1. Gates executados

| Gate                                      | Comando                                                            | Resultado                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Formatação                                | `pnpm format:check`                                                | ✅ _All matched files use Prettier code style_                                                   |
| Lint                                      | `pnpm lint`                                                        | ✅ 0 problemas                                                                                   |
| Tipos                                     | `pnpm typecheck`                                                   | ✅ 0 erros (`strict`, `noUncheckedIndexedAccess`, sem `any`)                                     |
| Unit                                      | `pnpm test:unit`                                                   | ✅ **201 passed** (10 arquivos)                                                                  |
| Integração                                | `pnpm test:integration`                                            | ✅ **89 passed** (5 arquivos)                                                                    |
| Contrato                                  | `pnpm test:contract`                                               | ✅ **62 passed**                                                                                 |
| Segurança                                 | `pnpm test:security`                                               | ✅ **42 passed**                                                                                 |
| Build                                     | `pnpm build`                                                       | ✅ 64 páginas; First Load JS compartilhado 102 kB                                                |
| Performance                               | `pnpm test:performance`                                            | ✅ JS 109 KB / 120 · CSS 13 KB / 25                                                              |
| Playwright (e2e + a11y + visual + layout) | `npx playwright test`                                              | ✅ **398 passed**, 18 pulados por viewport, 0 falhas, baselines sem atualização (4 viewports)    |
| Entrega Kal El                            | `pnpm test:kalel`                                                  | ✅ **33 passed** — a app em `CONTENT_SOURCE=kalel`, incluindo layout por tag e tag reservada     |
| Script oficial                            | `Run-Quality-Gates.ps1`                                            | ✅ _Todos os gates concluídos com sucesso_ — 13 gates; a11y 92, e2e 334, visual 64 no browser    |
| Kal El (repositório do CMS)               | suíte vitest de `apps/api`, branch `feat/delivery-published-order` | ✅ **179/179** (24 arquivos, Postgres local); `article-list-order` + `article-slug-filter` 26/26 |

O script oficial roda com o mesmo ambiente do bloco `env:` da CI (`APP_ENV=test`,
`CONTENT_SOURCE=fixture`, `NEXT_PUBLIC_SITE_URL=https://www.maquinanerd.test` e os dois
segredos de placeholder). Num shell sem variáveis, o gate `build` falha **de propósito**:
a validação de ambiente recusa um build de produção sem as credenciais do Kal El
(`CONTENT_SOURCE must be "kalel" in production`, observado nesta rodada). É a trava que
impede a fixture de chegar a um leitor, não um defeito.

Nenhum teste foi desabilitado nem pulado para passar. Os 18 "skipped" do Playwright são
testes que só se aplicam a um viewport (ex.: alvos de 44px só em 390px; faixa de editoria
só até 900px) e se declaram pulados nos outros três.

## 2. O que foi construído nesta rodada

Seguindo `maquina-nerd-kit/PROMPT-FRONTEND.md`, as oito etapas:

1. **Fundação.** Tailwind v4 com os tokens de `docs/01` como tema estático
   (`packages/tokens/src/tokens.css`), Montserrat 300–800 via `next/font`, breakpoints do
   kit (761/901/1101/1181/1241), paleta, raios e sombras padrão zerados.
2. **Primitivos** (`packages/ui`): HeroCard, OverlayCard, BigCard, FeatureVideoCard,
   StandardCard, VideoCard, SideList, RowCard, SectionTitle, Pagination, AdSlot, Kicker,
   Photo, cabeçalho com menu de nove itens e drawer, rodapé.
3. **Home** na ordem do protótipo.
4. **Editoria** `/[editoria]` e `/[editoria]/page/[n]`, `/page/[n]` para "mais notícias".
5. **Matéria padrão**, com a coluna de texto alinhada ao menu.
6. **Matéria overlay** (tag `capa-em-tela-cheia`).
7. **Oferta** `/ofertas/[slug]` (tag `oferta`), com caixa de produto, aviso de afiliados e
   conteúdo patrocinado.
8. **Busca e institucionais**: busca, autor, tag, ofertas, sobre, newsletter, anuncie,
   privacidade, cookies, termos, acessibilidade, política de afiliados, 404 e erro.

Adaptador em `lib/content/` devolvendo os tipos de `docs/04-dados.md`; nenhuma rota fala
com o Kal El diretamente. Detalhes e porquês em [DECISIONS.md §7](./DECISIONS.md).

**Para publicar:** `Dockerfile` (Next standalone, segredo de build via BuildKit),
`docker-compose.prod.yml`, `pnpm kalel:provision` (editorias, tags reservadas, webhook e
token no Kal El, idempotente, dry run por padrão) e o [RUNBOOK](./RUNBOOK.md) §1, §4.5 e §5.

**No Kal El:** branch `feat/delivery-published-order`, commit local `89c9eeb`, sem push —
ordem por publicação, página por offset com `total`, tags e entidades na listagem, índice
novo (migração `0006`). O portal funciona sem ela (cai no cursor), mas com ordem certa e
página O(1) só com ela. Ver [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md).

## 3. Cobertura das regras invioláveis do kit

| Regra                                    | Como está provado                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fidelidade aos protótipos                | [VISUAL-AUDIT.md](./VISUAL-AUDIT.md): 5 rotas × 4 larguras comparadas com os protótipos; 48 baselines de regressão                                                                          |
| Contraste ≥ 4,5:1                        | `tests/unit/tokens-contrast.test.ts` mede cada par cor/fundo; axe-core com 0 violações em 16 superfícies + drawer + consentimento, 4 viewports                                              |
| Cor de editoria só em faixa/filete/ativo | tokens `--color-ed-*` só nesses usos; Cinema usa `#7A21DB` como fundo com texto (o `#A248FC` do kit reprova com branco e com tinta)                                                         |
| Nenhum dado inventado                    | sem avatar sem retrato, sem "Mais vistos", sem periodicidade da newsletter; preço de demonstração marcado ao lado do preço; faixa "Demonstração" em modo fixture                            |
| Publicidade (docs/05)                    | rótulo "Publicidade", espaço reservado com medida, `aria-label`, nunca focável; `rel="sponsored nofollow"` em produto, patrocinados e corpo de matéria comercial; divulgação acima do texto |
| Mobile sem rolagem horizontal            | teste em todas as superfícies nos 4 viewports, sem `overflow-x: hidden` no documento                                                                                                        |
| Alvos 44px / 24px                        | `@a11y touch targets`                                                                                                                                                                       |
| Movimento reduzido, foco, aria           | `@a11y keyboard` e `@a11y motion`                                                                                                                                                           |

## 4. Revisão

O Codex CLI não roda nesta máquina: `codex-cli 0.151.0` rejeita `--uncommitted` com
prompt, e `codex exec` falha com o modelo padrão da conta ("requires a newer version of
Codex") e com `-m gpt-5` ("not supported when using Codex with a ChatGPT account"). Conforme
o `CLAUDE.md`, a CLI não foi atualizada e a revisão equivalente foi feita por um revisor
independente, somente leitura, sobre o diff inteiro. **Não é o Codex, e está identificada
como tal.**

Nove achados (2 altos, 5 médios, 2 baixos). Oito aceitos e corrigidos com teste de
regressão; um mantido com motivo (escopos do token, limitação do Kal El). Lista e decisões
em [DECISIONS.md §7.12](./DECISIONS.md) e `artifacts/codex-reviews/kit-*.md`.

## 5. Variáveis que o operador precisa fornecer

| Variável                                                         | Onde                               | Para quê                                                              |
| ---------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `KAL_EL_BASE_URL`                                                | portal                             | origem **https** pública da API do Kal El                             |
| `KAL_EL_SITE_ID`                                                 | portal                             | UUID do site Máquina Nerd no Kal El                                   |
| `KAL_EL_SERVICE_TOKEN`                                           | portal (secreto)                   | token de entrega (`pnpm kalel:provision --new-token` imprime uma vez) |
| `KAL_EL_WEBHOOK_SECRET`                                          | portal + provisionamento (secreto) | HMAC do webhook de revalidação, ≥ 32 caracteres                       |
| `KAL_EL_PREVIEW_SECRET`                                          | portal (secreto)                   | assinatura do grant de pré-visualização, ≥ 32 caracteres              |
| `NEXT_PUBLIC_SITE_URL`                                           | portal (build e runtime)           | `https://www.maquinanerd.com.br`                                      |
| `APP_ENV`                                                        | portal                             | `staging` ou `production`                                             |
| `TRUST_PROXY`                                                    | portal                             | `true` atrás de um proxy (o compose já define)                        |
| `MEDIA_ALLOWED_HOSTS`                                            | portal                             | hosts de imagem permitidos, se houver além do proxy de mídia          |
| `NEWSLETTER_PROVIDER_URL`                                        | portal                             | inscrição real; sem ela o formulário responde erro honesto (501)      |
| `KALEL_ADMIN_EMAIL`, `KALEL_ADMIN_PASSWORD`, `PORTAL_PUBLIC_URL` | só no provisionamento              | login de owner para `pnpm kalel:provision`; nunca vão para o portal   |

## 6. Plano seguro de staging e virada

Passo a passo no [RUNBOOK §5](./RUNBOOK.md). Em resumo:

1. **Kal El:** revisar e mergear `feat/article-slug-filter` e
   `feat/delivery-published-order`; rodar a migração `0006`; deploy da API.
2. **Provisionar:** `pnpm kalel:provision` (ensaio) → `--apply --new-token`.
3. **Staging:** `.env.production` com `APP_ENV=staging` num host que não seja o de
   produção (robots `Disallow: /`); `docker compose -f docker-compose.prod.yml up -d`;
   `/api/health?ready=1` verde; `pnpm visual:compare` contra o staging; redação usa por
   uma semana.
4. **Importação e URLs:** delta final do WordPress, `pnpm urls:verify` com a amostra de
   tráfego — zero 404 é bloqueante.
5. **Virada:** TTL do DNS a 300 s com 24 h de antecedência, `APP_ENV=production`, janela de
   tráfego baixo, 30 minutos de observação.
6. **Rollback:** DNS de volta ao WordPress (fica de pé 30 dias) ou a imagem anterior do
   portal (`docker compose up -d` na tag anterior).

## 7. Pendências externas

Nenhuma é contornável por código.

| #   | Pendência                                                        | O que bloqueia                           | Como resolver                                                                         |
| --- | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Credenciais do Kal El (seção 5)                                  | rodar contra o CMS real                  | fornecer as variáveis; rodar `kalel:provision`                                        |
| 2   | Merge e deploy das duas branches do Kal El                       | ordem por publicação e paginação O(1)    | revisão de quem cuida do CMS; migração `0006`                                         |
| 3   | Amostra de URLs de maior tráfego                                 | critério **zero 404**                    | exportar do Search Console para `data/import/top-urls.txt` e rodar `pnpm urls:verify` |
| 4   | Editoria dos 298 posts sem uma                                   | esses artigos não têm URL pública        | preencher o `--category-map` ([RUNBOOK §4.0.1](./RUNBOOK.md))                         |
| 5   | Licença das imagens de terceiros e `wp-content/uploads` extraído | mídia do acervo                          | decisão editorial ([DECISIONS 4.10](./DECISIONS.md)); extrair o `tar.gz`              |
| 6   | Modelo de produto e de layout no Kal El                          | caixa de produto com dado real           | aceitar a proposta em [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)                    |
| 7   | Network code do GAM                                              | anúncios reais                           | a reserva de espaço já está pronta                                                    |
| 8   | Provedor de newsletter                                           | inscrição real                           | `NEWSLETTER_PROVIDER_URL`                                                             |
| 9   | Revisão jurídica                                                 | termos, privacidade, cookies e afiliados | os textos são rascunhos neutros, sem promessa que o site não cumpra                   |
| 10  | Revisor Codex                                                    | revisão independente pelo Codex          | atualizar a CLI numa máquina com acesso; rodar `codex review --uncommitted`           |

## 8. Limitações declaradas

- **Nenhuma execução contra o Kal El real.** A aplicação inteira roda em
  `CONTENT_SOURCE=kalel` contra um CMS que valida as próprias respostas com os schemas da
  app, e a mudança do Kal El foi testada contra Postgres real. Não substitui latência,
  volume e comportamento sob carga do CMS de produção.
- **Build Docker não executado nesta máquina.** O Docker Desktop 29.6 está instalado, mas o
  WSL não tem nenhuma distribuição, e sem ela o daemon não sobe (esperado 5 minutos após
  abrir o Docker Desktop). Instalar a distro é mudança de sistema, fora do escopo. O
  Dockerfile segue o padrão standalone do Next; o primeiro `docker compose build` em
  staging é o teste. Para ensaiar aqui: `wsl --install`, reiniciar, abrir o Docker Desktop
  e rodar o build com um arquivo de ambiente em modo fixture (RUNBOOK §4.5).
- **Tema escuro saiu.** O kit só desenha o claro; um escuro seria visual inventado
  ([DECISIONS §7.1](./DECISIONS.md)). Os tokens permitem acrescentá-lo sem mexer em
  componente.
- **Uma instância.** Cache ISR e nonce de webhook em processo; escalar exige cache handler
  e `NonceStore` compartilhados ([RUNBOOK §3](./RUNBOOK.md)).
- **CSP com `'unsafe-inline'` em `script-src`** e **rate limit por instância**, como antes
  ([DECISIONS §5](./DECISIONS.md)).

## 9. Estado do repositório

Ignorados deliberadamente: os ZIPs de entrada (intactos, hashes em
[INPUT-INVENTORY.md](./INPUT-INVENTORY.md)), `maquina-nerd-kit/`, `.migration-reference/`,
`artifacts/` (capturas, relatórios de revisão), `.next/`, `node_modules/` e todo `.env*`
exceto `.env.example`. Versionadas de propósito: as 48 baselines visuais. Nada foi enviado
(sem push) nem implantado.
