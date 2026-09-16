# Verificação final — rodada do kit de front-end

Resultados **reais**, obtidos executando os comandos listados. A rodada do kit rodou em
2026-09-10; a revisão antes do merge e a publicação em staging, em 2026-09-14 e 15 (seção
4.2). O que não pôde ser verificado está nas pendências, não marcado como feito. A
verificação das rodadas anteriores (migração WordPress, integração Kal El, seis ciclos de
revisão) está no histórico do git, na versão deste arquivo do commit `41d79d6`; o que ela
provou continua coberto pelos mesmos testes, que seguem na suíte.

- **Branch:** `chore/maquina-nerd-kalel-migration`, com o
  [PR #1](https://github.com/maquinanerd/MN_Next/pull/1) mesclado em `eb58b4c`
- **Ambiente:** Windows 11, Node 24, pnpm 11, Next 15.5.4, Tailwind 4.1.13
- **Modo:** `APP_ENV=test`, `CONTENT_SOURCE=fixture` (Playwright) e `CONTENT_SOURCE=kalel`
  contra o CMS de contrato (`pnpm test:kalel`)

---

## 1. Gates executados

Última execução completa, sobre o código que foi mesclado (`1f526db`), com o ambiente do bloco
`env:` da CI.

| Gate                                      | Comando                                 | Resultado                                                                                                        |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Formatação                                | `pnpm format:check`                     | ✅ _All matched files use Prettier code style_                                                                   |
| Lint                                      | `pnpm lint`                             | ✅ 0 problemas                                                                                                   |
| Tipos                                     | `pnpm typecheck`                        | ✅ 0 erros (`strict`, `noUncheckedIndexedAccess`, sem `any`)                                                     |
| Unit                                      | `pnpm test:unit`                        | ✅ **201 passed** (10 arquivos)                                                                                  |
| Integração                                | `pnpm test:integration`                 | ✅ **99 passed** (7 arquivos)                                                                                    |
| Contrato                                  | `pnpm test:contract`                    | ✅ **67 passed** (3 arquivos)                                                                                    |
| Segurança                                 | `pnpm test:security`                    | ✅ **57 passed** (4 arquivos)                                                                                    |
| Build                                     | `pnpm build`                            | ✅ 63 páginas estáticas; First Load JS compartilhado 102 kB                                                      |
| Performance                               | `pnpm test:performance`                 | ✅ JS 109 KB / 120 · CSS 13 KB / 25                                                                              |
| Playwright (e2e + a11y + visual + layout) | `npx playwright test`                   | ✅ **406 passed**, 18 pulados por viewport, 0 falhas, baselines sem atualização (4 viewports)                    |
| Entrega Kal El                            | `pnpm test:kalel`                       | ✅ **34 passed** — inclui a readiness contra um Kal El sem a ordem por publicação (503, `contract: degraded`)    |
| Imagem Docker                             | job `Container image` da CI             | ✅ constrói em modo fixture, sobe o container, `/api/health` → `{"status":"ok"}`, processo sem root              |
| CI no GitHub (PR #1)                      | `.github/workflows/ci.yml`              | ✅ **9/9 jobs** ([run 34884651516](https://github.com/maquinanerd/MN_Next/actions/runs/34884651516))             |
| Script oficial                            | `Run-Quality-Gates.ps1`                 | ✅ na rodada do kit (13 gates; a11y 92, e2e 334, visual 64). Não repetido nesta rodada: os gates rodaram um a um |
| Kal El (repositório do CMS)               | vitest de `apps/api`, Postgres embutido | ✅ PR #6 **173/173** (23 arquivos) · PR #7 **188/188** (24 arquivos) · contracts 15/15 · db 8/8 · sdk 7/7        |

Os gates rodam com o mesmo ambiente do bloco `env:` da CI (`APP_ENV=test`,
`CONTENT_SOURCE=fixture`, `NEXT_PUBLIC_SITE_URL=https://www.maquinanerd.test` e os dois
segredos de placeholder). Num shell sem variáveis, o gate `build` falha **de propósito**:
a validação de ambiente recusa um build de produção sem as credenciais do Kal El
(`CONTENT_SOURCE must be "kalel" in production`). É a trava que impede a fixture de chegar a
um leitor, não um defeito.

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

**Para publicar:** `Dockerfile` (Next standalone; ambiente de build por _secret_ do BuildKit
ou por argumentos de build), `docker-compose.prod.yml`, `docker-compose.coolify.yml`,
`pnpm kalel:provision` (editorias, tags reservadas, webhook e token no Kal El, idempotente,
dry run por padrão) e o [RUNBOOK](./RUNBOOK.md) §1, §4.5, §4.5.1 e §5.

**No Kal El:** [#6](https://github.com/maquinanerd/kal-el/pull/6) (filtro `?slug=`) e
[#7](https://github.com/maquinanerd/kal-el/pull/7) (ordem por publicação, página por offset
com `total`, tags e entidades na listagem, índice novo na migração `0006`), mesclados e
publicados. A readiness do portal exige o #7 (`contract: ok`). Ver
[KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md).

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

## 4.1 A primeira CI no GitHub (PR #1)

O `ci.yml` nunca tinha rodado: até esta rodada o repositório não tinha remoto. Ao abrir o
[PR #1](https://github.com/maquinanerd/MN_Next/pull/1):

1. **Setup.** `pnpm/action-setup@v4` recusou `version: 11` junto com
   `packageManager: pnpm@11.15.1`. O `packageManager` virou a fonte única (`6b126ec`).
2. **Segunda execução: 6 de 8 jobs verdes** (hygiene, static, build, migration-tools, a11y,
   kalel). As duas falhas eram reais, e nenhuma é contornada:
   - **e2e — o menu andava 19,4px em relação à coluna no Linux.** A coluna de texto tinha
     largura fixa medida no Windows; o menu, com a largura do próprio texto, muda com a
     rasterização de cada sistema. Um leitor em Linux, Mac ou Android veria o desvio.
     Correção: os nove itens preenchem uma caixa da mesma largura fixa e crescem para
     ocupá-la ([DECISIONS §7.7](./DECISIONS.md)). No Windows a sobra é zero e as baselines
     não mudam.
   - **visual — no Linux as páginas saem mais altas** (ex.: matéria 5430 → 5485px): a
     quebra de linha muda com a rasterização. As baselines são do Windows, onde o projeto é
     desenvolvido, então o job visual passou a rodar em `windows-latest`; os demais seguem
     em Linux.
3. **Terceira execução (`51d3ef1`): os 8 jobs verdes**
   ([run 34650786964](https://github.com/maquinanerd/MN_Next/actions/runs/34650786964)) —
   hygiene, static, build, migration-tools, a11y, e2e e kalel em Linux, visual em Windows.

O e2e no Linux é o gate que vale a pena manter assim: foi ele que achou um desvio que
nenhuma execução em Windows mostraria, e que o leitor veria.

## 4.2 Revisão antes do merge e publicação (2026-09-14 e 15)

**Revisão.** Um revisor independente, somente leitura, leu o PR inteiro antes do merge: dois
bloqueantes, três altos, três médios e itens baixos. Todos foram corrigidos com teste, exceto o
H3, que é trabalho no Kal El e fica como pendência antes da importação do acervo. Lista,
correções e porquês em [DECISIONS §7.13](./DECISIONS.md). As correções começaram com um agente,
que parou no limite de uso da conta depois de dois commits (`02ab235`, `e867bc5`) e com a
readiness pela metade; o restante foi concluído e verificado diretamente, e a readiness,
revisada antes do commit (`93794b8`).

**Merge.** Com os gates da seção 1 verdes na máquina e 9/9 na CI, o PR #1 foi mesclado em
`chore/maquina-nerd-kalel-migration` (`eb58b4c`).

**Kal El no Coolify** (`vps.cinerie.com`, projeto "CMS Kal-El"): `main` em `6ca2470`, com os
PRs #5 a #10 do Kal El, publicado e conferido.

| Verificação     | Resultado                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Deploy          | build e troca dos containers em 3 min 55 s; `api` saudável pelo healthcheck em `/ready`                   |
| Migração `0006` | no banco de produção, só leitura: 7 migrações registradas e o índice `articles_site_status_published_idx` |
| API             | `GET /ready` → `{"status":"ready"}`; `GET /v1/health` → `{"status":"ok"}`; listagem sem token → 401       |
| CMS             | `GET /login` → 200                                                                                        |
| TLS             | certificado Let's Encrypt válido nos dois domínios; http → https com 302                                  |
| Bootstrap       | `POST /v1/bootstrap/init` → 403 "bootstrap is not available": owner criado e token vazio (kal-el#10)      |

**Portal no Coolify** (projeto "Máquina Nerd", ambiente `production`): recurso do repositório
público, branch `chore/maquina-nerd-kalel-migration`, build pack Docker Compose com
`docker-compose.coolify.yml`, domínio gerado passado a https
(`https://portal-xys58xzntjzf3xd5ar5snoq5.62.171.164.224.sslip.io`). Três deploys até o verde,
cada falha com a causa escrita no log do build:

| Deploy | Commit    | Resultado     | Causa e correção                                                                                                                                                                                                                                        |
| ------ | --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `eb58b4c` | falhou        | `KAL_EL_BASE_URL: Invalid url` e `KAL_EL_SITE_ID: Invalid uuid`: as duas variáveis vazias, que o Coolify repassa como texto vazio. Preenchidas; a validação passou a tratar vazio como ausente ([PR #2](https://github.com/maquinanerd/MN_Next/pull/2)) |
| 2      | `7806247` | falhou        | `KAL_EL_SERVICE_TOKEN is required in staging`, já com a mensagem nova. O operador rodou `scripts/coolify-provision.ps1`, que provisionou o Kal El e gravou o token direto no Coolify                                                                    |
| 3      | `7806247` | ✅ 3 min 33 s | —                                                                                                                                                                                                                                                       |

Verificado de fora, com o portal no ar:

| Verificação               | Resultado                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| TLS                       | certificado válido; http → https com 302                                                                |
| `/api/health`             | `{"status":"ok"}`                                                                                       |
| `/api/health?ready=1`     | 200, `{"env":"ok","kalel":"ok","contract":"ok"}`: token aceito e `total` presente (kal-el#7)            |
| Home e as 7 editorias     | 200; as categorias vieram do provisionamento                                                            |
| Indexação                 | `robots.txt` com `Disallow: /` e `X-Robots-Tag: noindex, nofollow` em toda resposta (`APP_ENV=staging`) |
| Busca                     | 200; `?page=6` → 404                                                                                    |
| `sitemap.xml`, `feed.xml` | 200                                                                                                     |
| Webhook sem assinatura    | 401                                                                                                     |
| Preview sem token         | 400                                                                                                     |

O provisionamento criou no site do Kal El as 7 editorias, as tags `capa-em-tela-cheia` e
`oferta`, o webhook para `/api/revalidate` e o token de entrega. A última chamada do script, a
que dispara o deploy, recebeu 405: o Coolify 4.3.19 não aceita GET em `/api/v1/deploy`. O deploy
foi disparado pelo painel, e o script passou a tentar POST antes de GET.

**Login no CMS.** O primeiro login real terminava de volta em `/login`. A API grava a sessão no
host `api-…`; o middleware do CMS a procurava no host `cms-…`, e o cliente lia o token CSRF de
`document.cookie`, que também não o enxerga. Em desenvolvimento os dois rodam em `localhost`,
e cookie não distingue porta, por isso nunca tinha aparecido. Corrigido no Kal El
([kal-el#11](https://github.com/maquinanerd/kal-el/pull/11), `8f7cf60`, API 190/190): o token
CSRF volta no corpo do login e em `/v1/auth/me` (neste, só quando o cookie confere com a
sessão), o CMS o guarda, e o middleware saiu. Publicado e conferido de fora: `/articles`
responde 200 sem o redirecionamento do middleware, o preflight de CORS libera a origem do CMS
com credenciais e `x-kal-el-csrf`, e login com credencial errada continua 401. Confirmado pelo
owner em 2026-09-16: o login entra no CMS, e a lista de artigos mostra um rascunho criado depois
da correção. Criar artigo exige `x-kal-el-csrf`, então as escritas também passam com CMS e API
em hosts diferentes.

## 5. Variáveis que o operador precisa fornecer

| Variável                                                         | Onde                               | Para quê                                                                          |
| ---------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| `KAL_EL_BASE_URL`                                                | portal                             | origem **https** pública da API do Kal El                                         |
| `KAL_EL_SITE_ID`                                                 | portal                             | UUID do site Máquina Nerd no Kal El                                               |
| `KAL_EL_SERVICE_TOKEN`                                           | portal (secreto)                   | token de entrega (`pnpm kalel:provision --new-token` imprime uma vez)             |
| `KAL_EL_WEBHOOK_SECRET`                                          | portal + provisionamento (secreto) | HMAC do webhook de revalidação, ≥ 32; no Coolify, `SERVICE_BASE64_64_WEBHOOK`     |
| `KAL_EL_PREVIEW_SECRET`                                          | portal (secreto)                   | assinatura do grant de pré-visualização, ≥ 32; no Coolify, gerado                 |
| `NEXT_PUBLIC_SITE_URL`                                           | portal (build e runtime)           | `https://www.maquinanerd.com.br`; no Coolify, o domínio do recurso                |
| `APP_ENV`                                                        | portal                             | `staging` ou `production` (`staging` por padrão no compose do Coolify)            |
| `TRUST_PROXY`                                                    | portal                             | `true` atrás de um proxy que reescreve `X-Forwarded-For` (os composes já definem) |
| `MEDIA_ALLOWED_HOSTS`                                            | portal                             | hosts de imagem permitidos, se houver além do proxy de mídia                      |
| `NEWSLETTER_PROVIDER_URL`                                        | portal                             | inscrição real; sem ela o formulário responde erro honesto (501)                  |
| `KALEL_ADMIN_EMAIL`, `KALEL_ADMIN_PASSWORD`, `PORTAL_PUBLIC_URL` | só no provisionamento              | login de owner para `pnpm kalel:provision`; nunca vão para o portal               |

No Coolify, `scripts/coolify-provision.ps1` cobre o provisionamento e o
`KAL_EL_SERVICE_TOKEN` de uma vez ([RUNBOOK §4.5.1](./RUNBOOK.md)).

## 6. Plano seguro de staging e virada

Passo a passo no [RUNBOOK §5](./RUNBOOK.md). Em resumo:

1. **Kal El:** ✅ feito — kal-el#6 e #7 mesclados, migração `0006` aplicada, API e CMS no
   Coolify, login do CMS corrigido (kal-el#11) — seção 4.2.
2. **Provisionar:** ✅ feito em 2026-09-15, pelo operador, com `scripts/coolify-provision.ps1`.
3. **Staging:** ✅ no ar no Coolify, com `APP_ENV=staging` e readiness `"contract":"ok"`
   (seção 4.2). Falta: publicar matérias, rodar `pnpm visual:compare` contra o staging e a
   redação usar por uma semana.
4. **Importação e URLs:** antes, o H3 (seção 7); depois, delta final do WordPress e
   `pnpm urls:verify` com a amostra de tráfego — zero 404 é bloqueante.
5. **Virada:** TTL do DNS a 300 s com 24 h de antecedência, `APP_ENV=production`, janela de
   tráfego baixo, 30 minutos de observação.
6. **Rollback:** DNS de volta ao WordPress (fica de pé 30 dias) ou redeploy do commit anterior
   do portal.

## 7. Pendências externas

Nenhuma é contornável por código neste repositório.

| #   | Pendência                                                        | O que bloqueia                           | Como resolver                                                                               |
| --- | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Rotação das credenciais usadas na publicação                     | nada técnico — é higiene                 | trocar a senha do owner no CMS e revogar o token da API do Coolify usado pelo script        |
| 2   | Leitura por ids de mídia e tags no Kal El (H3)                   | importar o acervo do WordPress           | mudança no Kal El e no adaptador ([DECISIONS §7.13](./DECISIONS.md))                        |
| 3   | Amostra de URLs de maior tráfego                                 | critério **zero 404**                    | exportar do Search Console para `data/import/top-urls.txt` e rodar `pnpm urls:verify`       |
| 4   | Editoria dos 298 posts sem uma                                   | esses artigos não têm URL pública        | preencher o `--category-map` ([RUNBOOK §4.0.1](./RUNBOOK.md))                               |
| 5   | Licença das imagens de terceiros e `wp-content/uploads` extraído | mídia do acervo                          | decisão editorial ([DECISIONS 4.10](./DECISIONS.md)); extrair o `tar.gz`                    |
| 6   | Modelo de produto e de layout no Kal El                          | caixa de produto com dado real           | aceitar a proposta em [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)                          |
| 7   | Network code do GAM                                              | anúncios reais                           | a reserva de espaço já está pronta                                                          |
| 8   | Provedor de newsletter                                           | inscrição real                           | `NEWSLETTER_PROVIDER_URL`                                                                   |
| 9   | Revisão jurídica                                                 | termos, privacidade, cookies e afiliados | os textos são rascunhos neutros, sem promessa que o site não cumpra                         |
| 10  | Revisor Codex                                                    | revisão independente pelo Codex          | atualizar a CLI numa máquina com acesso; rodar `codex review --uncommitted`                 |
| 11  | Domínio real e DNS                                               | virada                                   | apontar `maquinanerd.com.br` só com confirmação explícita; o `sslip.io` é só staging        |
| 12  | App antigo `kal-el:main-xgcxdbykmr…` no Coolify                  | nada — mas refaz o build a cada push     | decisão do dono do servidor: parar o auto-deploy ou remover; nunca subiu (Railpack)         |
| 13  | Matérias no Kal El                                               | as páginas do staging saem vazias        | publicar pelo CMS, ou importar o acervo depois do H3; cada publicação revalida pelo webhook |

## 8. Limitações declaradas

- **O portal roda contra o Kal El real, mas vazio.** Desde 2026-09-15 a readiness passa contra o
  Kal El publicado; sem matérias, latência, volume e comportamento sob carga só aparecem com o
  acervo.
- **Build Docker não roda nesta máquina** (Docker Desktop sem distribuição WSL; instalar é
  mudança de sistema, fora do escopo). A CI constrói a imagem e sobe o container a cada PR (job
  `Container image`), e o Coolify a construiu no deploy.
- **`sslip.io` com https.** O Coolify avisa que o Let's Encrypt limita emissões para esse
  domínio público. Funcionou para o Kal El e para o portal, mas o staging definitivo deve usar
  um subdomínio próprio.
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
exceto `.env.example`. Versionadas de propósito: as 48 baselines visuais. O portal está
mesclado e publicado em staging ([PR #1](https://github.com/maquinanerd/MN_Next/pull/1) e
[PR #2](https://github.com/maquinanerd/MN_Next/pull/2)); as mudanças do CMS
([kal-el#6](https://github.com/maquinanerd/kal-el/pull/6),
[kal-el#7](https://github.com/maquinanerd/kal-el/pull/7), as de deploy #8, #9 e #10 e o login
[#11](https://github.com/maquinanerd/kal-el/pull/11)) estão mescladas e publicadas no Coolify.
