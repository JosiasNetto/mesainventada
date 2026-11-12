# Registro de Decisões — Tasks 5 e 6 (`feat/jogadores-e-jogos-referencia`)

**Data:** 12/11/2026  
**Responsável:** Levi  
**Branch:** `feat/jogadores-e-jogos-referencia`

Este documento registra as decisões técnicas e de produto tomadas durante a implementação das tasks 5 e 6 de `contexto/tasks.txt`, para servir de memória do grupo, base para o post-mortem e guia para a próxima branch de interface.

---

## 1. Quantidade de jogadores (Task 6)

* **Faixa definida de `1` a `8` jogadores (mínimo alterado de `2` para `1`):**
  * O catálogo em `src/mecanicas.js` já previa mecânicas solo (`gestao-recursos` e `rolar-escrever` com `minJogadores: 1`), mas o formulário (`index.html`) e `app.js` bloqueavam o mínimo em `2`. Liberamos `min="1"` para suportar jogos solo.
* **Normalização centralizada e sincronizada com o campo (`src/jogadores.js` + `app.js`):**
  * Valores fora da faixa (`0`, negativos, decimais ou maiores que `8`) agora são arredondados e limitados entre `1` e `8` por `normalizarJogadores()`.
  * Corrigido o bug em que digitar `0` caía no fallback `4` (`Number('0') || 4`). Apenas campo vazio ou inválido usa o padrão `4`.
  * O campo `#jogadores` atualiza a compatibilidade durante a digitação e sincroniza o valor normalizado no `change`/`blur`.
* **Aviso explícito quando mecânicas deixam de ser compatíveis:**
  * Ao alterar o número de jogadores (ou materiais) de forma que alguma mecânica já selecionada não sirva mais, `removerMecanicasIncompativeis()` remove a mecânica e mostra um aviso explicando quais saíram e por quê (em vez de sumirem silenciosamente).
* **Prompts e travas sensíveis à escala de jogadores (`src/ia.js` e `src/validador.js`):**
  * `orientacaoJogadores()` adapta as instruções da IA para **1 jogador (solo)**, **2 jogadores (dupla)**, **3–5 jogadores** e **6–8 jogadores (mesa grande)** — neste último caso orientando limitar a mão inicial para caber no baralho de até 54 cartas.
  * A regra da `rodada` simulada no prompt também se adapta para solo quando `jogadores === 1`.
  * `validarKit()` passou a verificar: distribuição inicial de cartas × total do baralho para `N` jogadores, menções a "outros jogadores" em modo solo, citações conflitantes de `"para N jogadores"` nas regras e incompatibilidade das mecânicas do kit com a quantidade de jogadores.

---

## 2. Banco de jogos existentes e regras passadas (Task 5)

* **Separação do banco em arquivo JSON (`src/jogos-referencia.json`):**
  * Em vez de manter os jogos em um array grande dentro de código JS, os dados foram extraídos para `src/jogos-referencia.json` e carregados por `src/referencias.js` via `import ... with { type: 'json' }`, preservando funcionamento sem servidor nem etapa de build.
* **Arquétipos em texto com folga para expansão:**
  * Os jogos usam arquétipos de cartas em português, funcionando apenas com texto (até 120 caracteres por carta, 4 a 12 tipos de carta e no máximo 45 cartas no baralho base para deixar margem abaixo do limite de 54 cartas).
* **Tamanho e diversidade do banco (30 jogos):**
  * O catálogo foi expandido de 10 para **30 jogos** cobrindo estilos e temas bem distintos (ex.: masmorra cômica/Munchkin, steampunk/Catan, humor/Cartas Contra a Humanidade, mistério lateral/Black Stories, deckbuilding espacial, mitologia, pós-apocalíptico zumbi, culinária caótica, piratas, cyberpunk, espionagem, arqueologia, urbanismo, alquimia e clássicos brasileiros).
  * `test/referencias.test.js` valida automaticamente que o catálogo cobre todas as **13 mecânicas** de `src/mecanicas.js`, toda a faixa de **1 a 8 jogadores**, IDs únicos em kebab-case e aprovação no `validarKit` tanto em `minJogadores` quanto em `maxJogadores`.
* **Camada de prompts e mesclagem preservada no código (`src/referencias.js`, `src/ia.js`, `src/validador.js`):**
  * Foram mantidos prontos na base de código os adaptadores `referenciaDeVersao()`, `referenciaDeTexto()`, `mesclarCartasNoKit()`, `promptComReferencias()` e a flag `apenasCartasNovas` em `validarKit()`.

---

## 3. Decisão de Interface (UI) e próximos passos

* **Remoção da UI de "Ponto de partida" e do modal de referências (commit `6910188`):**
  * Após testar a usabilidade, decidiu-se **não manter** o seletor de "Ponto de partida" nem o modal extra na tela atual para evitar complicar o formulário inicial.
  * `index.html`, `style.css` e `app.js` ficaram com o layout original de `main`, mantendo apenas o ajuste de `1 a 8` jogadores e os avisos de incompatibilidade.
* **Direção combinada para uma próxima branch (não implementada ainda):**
  1. **Menos opções manuais na entrada:** ao descrever um jogo, a ferramenta deve conseguir aproveitar referências/estilos de forma mais direta, sem exigir escolhas complexas antes de gerar.
  2. **Chat de melhoria contínua:** em vez de depender de acertar tudo em um único prompt inicial, evoluir a tela de saída para um fluxo conversacional (chat) que permita ir refinando o jogo passo a passo até ficar do agrado de quem cria.

---

## Histórico de commits nesta branch

| Commit | Descrição |
|---|---|
| `566be7e` | `fix: normalizar quantidade de jogadores de 1 a 8 e avisar mecânicas incompatíveis` |
| `7e866c6` | `feat: adequar prompts e travas à escala de jogadores (1 a 8)` |
| `dcc7527` | `feat: mapear jogos existentes e arquétipos de cartas em src/referencias.js` |
| `9573691` | `feat: suportar modos baseados em jogos existentes e regras passadas na IA e validador` |
| `c83914d` | `feat: interface para selecionar jogos existentes, versões e regras passadas` |
| `19c4c12` | `refactor: extrair catálogo de jogos de referência para src/jogos-referencia.json` |
| `4ae583e` | `feat: expandir banco de jogos de referência para 30 estilos diversos e cobrir 13 mecânicas` |
| `6910188` | `revert: remover opções de ponto de partida e modal de referências da UI` |
