# Avaliacao de Tempo e Custo da Geracao de um Artefato (Tasks 10 e 11)

**Projeto:** MesaInventada - Criatividade Computacional 2026.2  
**Responsavel:** Lucas  
**Branch:** `feat/imagens-e-avaliacao-custo`  
**Provedores de IA Avaliados:** OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) e OpenAI API (`https://api.openai.com/v1`, ver secao 5)   
**Cotacao de Referencia:** `US$ 1,00 = R$ 5,80`

---

## 1. Objetivo e Metodologia

Este documento apresenta a avaliacao empirica e analitica do **tempo de geracao** e do **custo financeiro (em tokens, US$ e R$)** para produzir um artefato completo na ferramenta **MesaInventada** (regras do jogo, baralho de cartas, rodada de teste simulada, revisao pos-teste e ilustracoes das cartas geradas por IA).

A avaliacao foi implementada em duas frentes complementares:
1. **Telemetria em tempo real na interface (`src/custos.js` + `src/ia.js` + `app.js`):**
   - Toda chamada a OpenRouter (texto ou imagem) cronometra a latencia ponta a ponta (`duracaoMs`) e extrai o objeto `usage` retornado pela API (`prompt_tokens`, `completion_tokens`, `completion_tokens_details.image_tokens`, `total_tokens` e `cost` em US$).
   - O painel **Avaliacao de tempo e custo deste artefato** na tela do jogo e os selos no **Historico de Versoes** mostram o tempo e o custo real de cada versao gerada.
2. **Medicoes empiricas na API da OpenRouter:**
   - Foram executadas chamadas reais com a chave do projeto para medir latencia, consumo de tokens, tamanho do payload de imagem e custo cobrado por operacao.

---

## 2. Medicoes por Etapa de Geracao

### 2.1. Etapa de Texto: Criacao do Kit Inicial e Revisao Pos-Teste

Na geracao de texto (`chamarLLMComMetricas`), a ferramenta envia o sistema de co-design + parametros do formulario (tema, jogadores, duracao, materiais e mecanicas selecionadas) e recebe um JSON estruturado com `titulo`, `objetivo`, `preparacao`, `turno`, `fim`, `cartas` (4 a 12 tipos), `rodada` e `provocacao`.

| Operacao | Modelo na OpenRouter | Prompt Tokens | Completion Tokens | Total Tokens | Tempo Medido | Custo Unitario (US$) | Custo Unitario (R$) |
|---|---|---:|---:|---:|---:|---:|---:|
| **Criar Kit (Texto - Gratis)** | `nvidia/nemotron-3.5-super-vl:free` / `openrouter/free` | 415 - 550 | 750 - 9.105* | 1.200 - 9.520 | 6,0 s - 18,5 s | **US$ 0,0000** | **R$ 0,0000** |
| **Revisar Kit (Relato - Gratis)** | `openrouter/free` / `google/gemma-4-31b-it:free` | 950 - 1.350 | 800 - 4.500 | 1.750 - 5.850 | 7,5 s - 19,0 s | **US$ 0,0000** | **R$ 0,0000** |
| **Criar Kit (Texto - Pago Flash)** | `google/gemini-2.5-flash` (referencia paga) | ~480 | ~850 | ~1.330 | 3,2 s - 5,5 s | **US$ 0,0023** | **R$ 0,0133** |
| **Revisar Kit (Relato - Pago Flash)** | `google/gemini-2.5-flash` (referencia paga) | ~1.100 | ~900 | ~2.000 | 3,8 s - 6,2 s | **US$ 0,0026** | **R$ 0,0151** |

*\*Nota: Modelos gratuitos com raciocinio interno (como `baidu/ernie-5.5-flash-preview:free` acionado via `openrouter/free`) incluem tokens de raciocinio no `completion_tokens`, mas mantem custo `US$ 0,0000`.*

---

### 2.2. Etapa Visual: Geracao de Imagens para as Cartas (Task 10)

A OpenRouter disponibiliza geracao de imagens via `chat/completions` com `modalities: ["image", "text"]`. Avaliamos os modelos de imagem compativeis na plataforma e realizamos medicoes empiricas reais:

| Modelo de Imagem (OpenRouter) | Prompt Tokens | Image / Completion Tokens | Payload Base64 Bruto | Payload Compactado (`canvas`) | Tempo por Carta | Custo Real por Carta (US$) | Custo por Carta (R$) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **`google/gemini-3.1-flash-lite-image`** *(Padrao)* | 32 | 1.120 (`image_tokens`) | 188 KB (JPEG) | ~18 KB (JPEG 360px) | **4,97 s** | **US$ 0,0336** | **R$ 0,1949** |
| **`google/gemini-2.5-flash-image`** *(Reserva)* | 35 | 1.290 (`image_tokens`) | ~210 KB (JPEG) | ~20 KB (JPEG 360px) | **5,40 s** | **US$ 0,0387** | **R$ 0,2245** |
| **`openai/gpt-5-image-mini`** *(Reserva)* | 3.364 | 5.816 (`4.175 image`) | 3.385 KB (PNG) | ~22 KB (JPEG 360px) | **11,70 s** | **US$ 0,0451** | **R$ 0,2615** |
| **`google/gemini-3.1-flash-image`** | ~35 | 1.120 (`image_tokens`) | ~195 KB (JPEG) | ~19 KB (JPEG 360px) | ~5,80 s | **US$ 0,0672** | **R$ 0,3898** |

#### Conclusoes Tecnicas da Medicao de Imagens:
1. **Escolha do modelo padrao (`google/gemini-3.1-flash-lite-image`):**
   - Custou **US$ 0,033608 por carta** (25% mais barato que o `openai/gpt-5-image-mini`, que cobrou **US$ 0,045092** devido ao maior volume de tokens de imagem e prompt interno).
   - Respondeu em **4,97 segundos** por carta.
   - Entregou um payload bruto 18 vezes menor (`188 KB` contra `3,38 MB` do `gpt-5-image-mini`).
2. **Importancia da compactacao via `<canvas>` (`compactarImagem` em `app.js`):**
   - Sem compactacao, 8 cartas ilustradas ocupariam de `1,5 MB` a `27 MB` no `localStorage`, estourando rapidamente a cota de `5 MB` do navegador na segunda versao do jogo.
   - Com o redimensionamento automatico para `360px` em JPEG (`qualidade 0.76`), cada ilustracao passa a ocupar cerca de **18 a 22 KB**, mantendo nitidez para impressao em cartas de `63x88 mm` e permitindo salvar dezenas de versoes ilustradas no navegador.

---

## 3. Tempo e Custo Total de um Artefato Completo

Um jogo gerado na **MesaInventada** possui entre **4 e 12 tipos de carta** (media tipica de **6 tipos de carta** por kit). A tabela abaixo consolida o tempo e o custo total para produzir 1 artefato completo em diferentes cenarios de uso:

| Cenario de Geracao do Artefato | Etapas Incluidas | Tempo Total Estimado | Custo Total (US$) | Custo Total (R$) | Quantos Artefatos Cabem em US$ 4,00? |
|---|---|---:|---:|---:|---:|
| **1. Prototipo Rapido (Somente Texto - Gratis)** | 1 criacao de kit + 1 revisao (modelos `:free`) | **13 s - 35 s** | **US$ 0,0000** | **R$ 0,00** | **Ilimitado** (respeitando limite diario de 50 req `:free`) |
| **2. Prototipo com 1 Carta-Destaque Ilustrada** | Texto `:free` + 1 imagem (`gemini-3.1-flash-lite-image`) | **~12 s - 23 s** | **US$ 0,0336** | **R$ 0,19** | **119 artefatos** |
| **3. Kit Completo Ilustrado (4 tipos de carta)** | Texto `:free` + 4 imagens (`gemini-3.1-flash-lite-image`) | **~27 s - 38 s** | **US$ 0,1344** | **R$ 0,78** | **29 kits completos** |
| **4. Kit Completo Ilustrado Medio (6 tipos de carta)** | Texto `:free` + 6 imagens (`gemini-3.1-flash-lite-image`) + 1 revisao | **~38 s - 55 s** | **US$ 0,2016** | **R$ 1,17** | **19 kits completos** |
| **5. Kit Completo Ilustrado Grande (8 tipos de carta)** | Texto `:free` + 8 imagens (`gemini-3.1-flash-lite-image`) + 1 revisao | **~48 s - 65 s** | **US$ 0,2688** | **R$ 1,56** | **14 kits completos** |
| **6. Kit Maximo (12 tipos de carta ilustradas)** | Texto `:free` + 12 imagens (`gemini-3.1-flash-lite-image`) | **~67 s - 80 s** | **US$ 0,4032** | **R$ 2,34** | **9 kits completos** |

---

## 4. Decisoes de Engenharia Guiadas pela Avaliacao de Custo e Tempo

1. **Geracao de imagens sob demanda (botoes `🎨 ilustrar` e `🎨 Ilustrar todas as cartas`) em vez de automatica no `CRIAR JOGO`:**
   - **Impacto no Tempo:** Gerar 6 imagens automaticamente no clique de `CRIAR JOGO` adicionaria ~30 segundos de espera antes mesmo de o usuario ler se gostou das regras. Separando em um botao, o kit de texto nasce em poucos segundos e as ilustracoes sao geradas progressivamente (`Ilustrando 1/6...`, `2/6...`) com feedback visual imediato carta a carta.
   - **Impacto no Custo:** Em um fluxo criativo normal, um grupo gera e descarta ou revisa regras 3 a 5 vezes antes de chegar na versao final para impressao. Se toda geracao de texto disparasse 6 imagens automaticamente, cada teste custaria `US$ 0,20` (consumindo `US$ 1,00` em apenas 5 tentativas). Com o acionamento por botao apenas quando o baralho esta aprovado, o custo durante a fase de experimentacao de regras cai para **US$ 0,00**, multiplicando por **4x a 5x** a durabilidade do orcamento de `US$ 4,00` da chave do professor.
2. **Preservacao automatica das ilustracoes nas revisoes (`app.js`):**
   - Quando o usuario relata uma dificuldade de playtest e clica em **Revisar com IA**, o `app.js` reaproveita automaticamente as imagens das cartas cujo nome permaneceu igual na nova versao (`v2`, `v3`), evitando cobrar novamente por ilustracoes ja geradas.

---

## 5. Medicoes Empiricas na Plataforma da OpenAI

Como o `src/ia.js` tambem aceita chaves da OpenAI (`sk-...` / `sk-proj-...`), medimos tempo e custo dos modelos de texto e de imagem disponiveis diretamente na plataforma da OpenAI.

### 5.1. Metodologia

- **Script reproduzivel:** `scripts/benchmark-openai.js` (resultados brutos em `scripts/resultados-benchmark-openai.json`). Rodar com `node scripts/benchmark-openai.js [repeticoes]`; a chave vem de `OPENAI_API_KEY` ou de um `.env` na raiz (ignorado pelo git).
- **Prompts reais do app:** texto via `promptKit` (tema "Exploradores de um mercado flutuante numa cidade alagada", 4 jogadores, 20 min, dificuldade `medio`, mecanicas *Colecao de conjuntos* + *Gestao de recursos escassos*, `response_format: json_object`); imagem via `promptImagemCarta` (carta "Barqueiro Astuto").
- **Modelos testados:** o script consulta `/v1/models` e mede apenas os modelos liberados para a chave. Na chave do projeto estavam disponiveis **`gpt-5-nano`, `gpt-5-mini`, `gpt-5`** (texto) e **`gpt-image-1-mini`** (imagem). `gpt-4o-mini`, `gpt-4.1-*`, `gpt-4o`, `o4-mini`, `gpt-image-1`, `dall-e-3` e `dall-e-2` nao estavam habilitados e ficaram fora da medicao.
- **Tempo:** latencia ponta a ponta da requisicao HTTP (sem streaming). Texto: 2 execucoes por modelo; imagem: 1 execucao por nivel de qualidade.
- **Custo:** a API da OpenAI nao devolve custo, entao ele foi calculado a partir do `usage` retornado e dos precos oficiais (Standard tier, conferidos em `developers.openai.com/api/docs/pricing` em 16/11/2026):

| Modelo | Entrada (US$/1M tokens) | Saida (US$/1M tokens) |
|---|---:|---:|
| `gpt-5-nano` | 0,05 | 0,40 |
| `gpt-5-mini` | 0,25 | 2,00 |
| `gpt-5` | 1,25 | 10,00 |
| `gpt-image-1-mini` | 2,00 (texto) | 8,00 (imagem) |

- **Data da medicao:** 16/11/2026.

### 5.2. Texto: Criacao do Kit Inicial

| Modelo (OpenAI) | Prompt Tokens | Completion Tokens | Tokens de Raciocinio | Tipos de Carta Gerados | Tempo Medio (min - max) | Custo Medio (US$) | Custo Medio (R$) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **`gpt-5-nano`** | 430 | 10.125 - 12.889 | 9.472 - 12.224 | 10 - 11 | **63,2 s** (54,6 - 71,8) | **US$ 0,0046** | **R$ 0,027** |
| **`gpt-5-mini`** | 430 | 4.621 - 5.201 | 3.712 - 4.288 | 7 - 8 | **63,5 s** (63,2 - 63,8) | **US$ 0,0099** | **R$ 0,058** |
| **`gpt-5`** | 430 | 6.132 - 8.092 | 5.248 - 7.296 | 9 - 11 | **103,5 s** (95,5 - 111,5) | **US$ 0,0717** | **R$ 0,416** |

Todas as 6 execucoes devolveram JSON valido no formato do kit (`extrairJSON` sem erro).

### 5.3. Imagem: Ilustracao de uma Carta

| Modelo (OpenAI) | Qualidade / Tamanho | Tokens de Entrada | Tokens de Imagem (saida) | Payload (JPEG) | Tempo por Carta | Custo por Carta (US$) | Custo por Carta (R$) |
|---|---|---:|---:|---:|---:|---:|---:|
| **`gpt-image-1-mini`** | `low` · 1024x1024 | 152 | 272 | 185 KB | **10,06 s** | **US$ 0,0025** | **R$ 0,014** |
| **`gpt-image-1-mini`** | `medium` · 1024x1024 | 152 | 1.056 | 247 KB | **13,61 s** | **US$ 0,0088** | **R$ 0,051** |

### 5.4. Tempo e Custo de um Artefato Completo com a OpenAI

Estimativa com geracao sequencial (1 kit de texto + N ilustracoes, como no botao `🎨 Ilustrar todas as cartas`), usando as medias acima:

| Cenario | Texto | Imagens | Tempo Total Estimado | Custo Total (US$) | Custo Total (R$) | Artefatos em US$ 4,00 |
|---|---|---|---:|---:|---:|---:|
| Somente texto | `gpt-5-nano` | - | ~63 s | US$ 0,0046 | R$ 0,03 | 865 |
| Somente texto | `gpt-5-mini` | - | ~64 s | US$ 0,0099 | R$ 0,06 | 402 |
| Somente texto | `gpt-5` | - | ~104 s | US$ 0,0717 | R$ 0,42 | 55 |
| Kit medio (6 cartas) | `gpt-5-nano` | 6 x `low` | ~124 s | US$ 0,0195 | R$ 0,11 | 205 |
| **Kit medio (6 cartas)** | **`gpt-5-mini`** | **6 x `low`** | **~124 s** | **US$ 0,0248** | **R$ 0,14** | **161** |
| Kit medio (6 cartas) | `gpt-5-mini` | 6 x `medium` | ~145 s | US$ 0,0624 | R$ 0,36 | 64 |
| Kit medio (6 cartas) | `gpt-5` | 6 x `medium` | ~185 s | US$ 0,1242 | R$ 0,72 | 32 |
| Kit maximo (12 cartas) | `gpt-5-mini` | 12 x `low` | ~184 s | US$ 0,0397 | R$ 0,23 | 100 |
| Kit maximo (12 cartas) | `gpt-5-mini` | 12 x `medium` | ~227 s | US$ 0,1149 | R$ 0,67 | 34 |

### 5.5. Conclusoes da Medicao na OpenAI

1. **Custo muito baixo, tempo alto.** Os modelos GPT-5 sao baratos por kit (de US$ 0,005 a US$ 0,07), mas levam de **~1 a ~2 minutos** para responder, contra 3 a 19 s dos modelos medidos na OpenRouter (secao 2.1). O motivo sao os **tokens de raciocinio**: entre 80% e 95% dos `completion_tokens` sao raciocinio interno, cobrados como saida mas invisiveis no kit.
2. **`gpt-5-nano` gasta mais tokens que o `gpt-5-mini`.** O nano raciocinou ~2,4x mais (ate 12.889 tokens) e mesmo assim saiu pela metade do preco, mas com o mesmo tempo (~63 s). O **`gpt-5-mini`** teve o tempo mais estavel (63,2 - 63,8 s) e e o melhor equilibrio para o texto.
3. **`gpt-5` ultrapassa o timeout do app.** As duas execucoes (95,5 s e 111,5 s) passaram dos **90 s** de `AbortSignal.timeout(90_000)` em `chamarLLMComMetricas`; no app, o usuario receberia "A IA demorou mais de 90 segundos". O `gpt-5` nao e viavel com o timeout atual.
4. **`gpt-image-1-mini` em `low` e a ilustracao mais barata medida no projeto:** US$ 0,0025 por carta, **13x mais barata** que o `google/gemini-3.1-flash-lite-image` da OpenRouter (US$ 0,0336, secao 2.2), porem ~2x mais lenta (10,1 s contra 4,97 s). Em `medium` o custo sobe 3,5x (US$ 0,0088) para +3,5 s por carta.
5. **Pontos de atencao para usar a OpenAI no app:**
   - O modelo padrao para chaves OpenAI (`MODELO_PADRAO_OPENAI = 'gpt-4o-mini'`) **nao estava habilitado** na chave testada; com essa chave, o usuario precisaria configurar `gpt-5-mini` em ⚙ Configurar.
   - `gerarImagemCarta` hoje chama apenas a OpenRouter (`modalities: ['image','text']`); para usar `gpt-image-1-mini` com chave OpenAI seria preciso chamar `/v1/images/generations`, como no script de benchmark.
   - Para reduzir o tempo do texto, vale testar `reasoning_effort: 'minimal'` ou `'low'` nos modelos GPT-5 (nao medido aqui), ja que o raciocinio domina a latencia e o custo.
