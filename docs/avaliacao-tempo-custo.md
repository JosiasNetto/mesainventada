# Avaliacao de Tempo e Custo da Geracao de um Artefato (Tasks 10 e 11)

**Projeto:** MesaInventada - Criatividade Computacional 2026.2  
**Responsavel:** Lucas  
**Branch:** `feat/imagens-e-avaliacao-custo`  
**Provedor de IA Avaliado:** OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`)  
**Orcamento da Chave Fornecida pelo Professor:** `US$ 4,00` (`limit_usd: 4.00`)  
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
