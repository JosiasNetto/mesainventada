# MesaInventada MVP (Checkpoint 1 · 10/11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma página web pública onde qualquer pessoa informa tema, jogadores, duração e materiais, escolhe uma mecânica (ou duas, para combinar) e recebe da IA um kit de jogo de cartas editável (regras, cartas, rodada de teste, provocação). O kit passa por travas, fica num histórico de versões, pode ser revisado a partir do relato do teste e sai em PDF Print & Play A4.

**Architecture:** Site estático (HTML + CSS + módulos JS, sem build) no GitHub Pages. O navegador chama a OpenRouter com a chave da própria pessoa (BYOK). Cada caixa do diagrama vira um arquivo: o Módulo A é `src/mecanicas.js`, a API externa é `src/ia.js`, o Módulo B é `src/validador.js` e o Módulo C é `#impressao` + `@media print`. Neste MVP o banco SQLite vira `localStorage`.

**Tech Stack:** HTML/CSS/JS puros (ES modules) · OpenRouter Chat Completions via `fetch` · `localStorage` · `window.print()` · testes com `node --test` (Node ≥ 22, zero dependências npm).

**Spec:** `Lancamento-Projeto-Ferramenta-CriaComp-2026-2.pdf` (exigências do professor), `MesaInventada_Relatorio_Formatado.pdf` (escopo 6.3, compromissos 6.4), `MesaInventada_Caixa_Preta_e_Transparente.pdf` (arquitetura), `MesaInventada_Prototipo_Baixa_Fidelidade.pdf` (tela única), todos na raiz do projeto.

## Global Constraints

- "tudo no navegador, 1 tela só" · "sem imagens de IA nas cartas" (protótipo).
- Escopo: "jogos de cartas de curta duração" (relatório 6.3).
- "Se pedir chave, a ferramenta explica onde conseguir uma." (brief, slide 10)
- "Falhar com aviso. Quando o modelo não responde, a pessoa precisa saber o que aconteceu e o que fazer." (slide 10)
- "Funcionar fora da máquina de vocês, com um endereço ou um passo a passo que outro grupo siga sozinho." (slide 10)
- "Tudo o que a pessoa precisa saber tem que estar na própria ferramenta." (slide 8)
- "Deixar a pessoa repetir e comparar. Semente, histórico, versões lado a lado." (slide 10)
- "Na apresentação, vocês precisam saber dizer onde a IA entra e o que ela decide." (slide 6)
- Relatório 6.4: oferecer alternativas antes de consolidar, incorporar provocações e tratar o resultado como "protótipo revisável".
- Interface 100% em português do Brasil.
- Zero dependências npm e zero build: a página roda em qualquer servidor estático.
- Texto vindo do modelo entra no DOM só via `textContent`, nunca via `innerHTML`.
- Modelo padrão `google/gemma-4-31b-it:free` (gratuito, aceita `response_format` e `seed` na OpenRouter em 09/11/2026). Os avisos de erro sugerem `openrouter/free` como alternativa.
- Toda mudança em relação ao diagrama ou ao protótipo fica registrada no README, porque o brief diz que "a mudança precisa ser registrada" (Task 7).

## Contratos compartilhados

```js
// Entrada: lida do formulário e guardada em cada versão
{ tema: string, jogadores: number /*2–8*/, duracao: number /*min, 10–90*/,
  materiais: string[] /*sempre 'papel'; opcionais 'caneta', 'dado'*/, dificuldade: 'facil' | 'medio' }

// Mecanica: item do catálogo (Task 1)
{ id: string, nome: string, descricao: string,
  familia: 'cooperativo' | 'competitivo' | 'informacao-oculta' | 'negociacao' | 'sorte',
  precisa: string[] /*materiais além de papel*/, minJogadores: number, maxJogadores: number }

// Kit: o que a IA devolve (Task 3) e as travas checam (Task 2)
{ titulo: string, objetivo: string, preparacao: string[], turno: string[], fim: string,
  cartas: { nome: string, texto: string, quantidade: number }[],
  rodada: string[], provocacao: string, mudancas?: string[] /*só em revisões*/ }

// Projeto: localStorage 'mi:projeto'. Configuração: 'mi:chave', 'mi:modelo'
{ sementeMecanicas: number, atual: number /*índice em versoes*/,
  versoes: { n: number, criadaEm: string /*ISO*/, origem: 'gerado' | 'revisado', entrada: Entrada,
             mecanicas: Mecanica[], semente: number, kit: Kit, relato?: string }[] }
```

## Review Focus

1. **Modelo devolve kit malformado** (campo faltando, `cartas` como string, `quantidade: "2"`): as travas avisam e a tela mostra o que existe, sem quebrar. Coberto pelo teste `kit vazio ou malformado não quebra` (Task 2) e pelo passo de verificação com resposta malformada (Task 5).
2. **Pessoa sem chave clica CRIAR JOGO:** abre o diálogo com o passo a passo da OpenRouter e nenhuma requisição sai. Verificado na Task 5.
3. **Clique duplo em CRIAR JOGO durante o carregamento:** gera uma única versão. Verificado na Task 5.
4. **`localStorage` bloqueado** (aba anônima estrita, navegador do laboratório): a página funciona, só não lembra nada. Verificado na Task 4.
5. **Carta com texto enorme na impressão:** a trava avisa (teste na Task 2) e o texto não vaza da carta de 63×88 mm (verificação na Task 6).

## Ordem e tempo

| Task | O quê | ~Tempo |
|---|---|---|
| 1 | Base + Módulo A (mecânicas) | 30 min |
| 2 | Módulo B (travas) | 30 min |
| 3 | IA (`src/ia.js`) | 45 min |
| 4 | Tela: formulário, mecânicas, chave, ajuda | 60 min |
| 5 | CRIAR JOGO ponta a ponta | 90 min |
| 6 | Módulo C: Print & Play A4 | 45 min |
| 7 | Publicar + README + entrega do checkpoint | 30 min |
| 8 | Revisão por relato, histórico, comparação | 60 min |

As Tasks 1 a 7 já formam o checkpoint "ponta a ponta, ainda que mínimo". Se o tempo apertar, a Task 8 é a que fica para depois de 10/11, com prazo até o Checkpoint 2 (12/11). Um integrante pode criar o repositório no GitHub (Task 7, passo 2) em paralelo, a qualquer momento.

---

### Task 1: Base do projeto + Módulo A (motor de mecânicas)

**Files:**
- Create: `package.json`, `.gitignore`, `src/mecanicas.js`
- Test: `test/mecanicas.test.js`

**Interfaces:**
- Produces: `catalogo: Mecanica[]`; `escolherMecanicas(entrada: Entrada, semente: number): Mecanica[]` devolve no máximo 3 mecânicas.

- [ ] **Step 1: Inicializar o repositório**

```bash
cd /home/josias-notebook/faculdade/criacomp/mesaInventada
git init -b main
printf '*:Zone.Identifier\nnode_modules/\n' > .gitignore
```
Crie o `package.json` com o conteúdo `{ "name": "mesainventada", "private": true, "type": "module", "scripts": { "test": "node --test test/*.test.js" } }`.

- [ ] **Step 2: Escrever o teste que falha**

```js
// test/mecanicas.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogo, escolherMecanicas } from '../src/mecanicas.js';

const entrada = { tema: 'espaço', jogadores: 4, duracao: 20, materiais: ['papel', 'caneta', 'dado'], dificuldade: 'facil' };

test('catálogo tem 12+ mecânicas em 5 famílias', () => {
  assert.ok(catalogo.length >= 12);
  assert.equal(new Set(catalogo.map(m => m.familia)).size, 5);
});

test('devolve 3 mecânicas de famílias diferentes', () => {
  const r = escolherMecanicas(entrada, 1);
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map(m => m.familia)).size, 3);
});

test('mesma semente, mesmo resultado; sementes diferentes variam', () => {
  assert.deepEqual(escolherMecanicas(entrada, 7), escolherMecanicas(entrada, 7));
  const vistos = new Set();
  for (let s = 1; s <= 10; s++) vistos.add(escolherMecanicas(entrada, s).map(m => m.id).join());
  assert.ok(vistos.size > 1);
});

test('respeita materiais e número de jogadores', () => {
  const r = escolherMecanicas({ ...entrada, jogadores: 2, materiais: ['papel'] }, 3);
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map(m => m.id)).size, 3);
  for (const m of r) {
    assert.deepEqual(m.precisa, []);
    assert.ok(m.minJogadores <= 2 && 2 <= m.maxJogadores);
  }
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Cannot find module '.../src/mecanicas.js'`.

- [ ] **Step 4: Implementar `src/mecanicas.js`**

`catalogo` com exatamente estas 13 entradas. A `descricao` de cada uma é uma frase de até 100 caracteres, escrita por você:

| id | nome | familia | precisa | jogadores |
|---|---|---|---|---|
| gestao-recursos | Gestão de recursos escassos | cooperativo | [] | 1–6 |
| contra-relogio | Contra o relógio | cooperativo | [] | 2–6 |
| comunicacao-limitada | Comunicação limitada | cooperativo | [] | 2–6 |
| colecao-conjuntos | Coleção de conjuntos | competitivo | [] | 2–6 |
| vazas | Vazas | competitivo | [] | 3–6 |
| controle-setores | Controle de setores | competitivo | [] | 2–5 |
| draft | Draft de cartas | competitivo | [] | 2–6 |
| blefe | Blefe e dedução | informacao-oculta | [] | 3–8 |
| papeis-secretos | Papéis secretos | informacao-oculta | [] | 4–8 |
| negociacao | Negociação e troca | negociacao | [] | 3–6 |
| leilao | Leilão | negociacao | ['caneta'] | 3–6 |
| forcar-sorte | Forçar a sorte | sorte | ['dado'] | 2–6 |
| rolar-escrever | Rolar e escrever | sorte | ['dado', 'caneta'] | 1–8 |

`escolherMecanicas` segue estes passos:
1. Filtra o catálogo pelas mecânicas com `precisa` ⊆ `entrada.materiais` e `minJogadores ≤ jogadores ≤ maxJogadores`.
2. Embaralha o resultado com Fisher-Yates usando `mulberry32(semente)`.
3. Pega a primeira mecânica de cada família, até juntar 3.
4. Se ainda faltar, completa com as restantes na ordem embaralhada.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: 4 testes passam, 0 falham.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore src/mecanicas.js test/mecanicas.test.js
git commit -m "feat: Módulo A — catálogo e escolha de mecânicas com semente"
```

---

### Task 2: Módulo B (travas de equilíbrio)

**Files:**
- Create: `src/validador.js`
- Test: `test/kit-exemplo.js` (fixture), `test/validador.test.js`

**Interfaces:**
- Produces: `validarKit(kit: unknown, entrada: Entrada): string[]` devolve `[]` quando o kit está ok e nunca lança exceção. Também `kitExemplo` e `entradaExemplo` em `test/kit-exemplo.js`, que as Tasks 3, 5, 6 e 8 reutilizam.

- [ ] **Step 1: Criar a fixture `test/kit-exemplo.js`**

```js
export const entradaExemplo = { tema: 'jogo cooperativo sobre exploração espacial', jogadores: 4, duracao: 20,
  materiais: ['papel', 'caneta', 'dado'], dificuldade: 'facil' };

export const kitExemplo = {
  titulo: 'Oxigênio Zero',
  objetivo: 'Consertar a nave juntos antes que o oxigênio acabe.',
  preparacao: ['Embaralhe as cartas.', 'Anote 10 de oxigênio no papel.'],
  turno: ['Role o dado: com 1 ou 2, perca essa quantidade de oxigênio.', 'Compre uma carta.', 'Use uma Ferramenta para consertar uma Falha.'],
  fim: 'Vencem ao consertar 6 falhas; perdem se o oxigênio chegar a 0.',
  cartas: [
    { nome: 'Vazamento', texto: 'Falha. Perca 1 de oxigênio por turno até consertar.', quantidade: 4 },
    { nome: 'Curto-circuito', texto: 'Falha. O próximo jogador não pode usar Ferramentas.', quantidade: 3 },
    { nome: 'Chave inglesa', texto: 'Ferramenta. Conserte 1 falha.', quantidade: 5 },
    { nome: 'Fita isolante', texto: 'Ferramenta. Conserte um Vazamento ou ganhe 1 de oxigênio.', quantidade: 4 },
    { nome: 'Tanque reserva', texto: 'Ganhe 3 de oxigênio.', quantidade: 2 },
    { nome: 'Pane geral', texto: 'Todos descartam 1 carta.', quantidade: 2 },
  ],
  rodada: ['Ana rola o dado: 2. O oxigênio cai de 10 para 8.', 'Ana compra Vazamento.', 'Ana usa Fita isolante e conserta o Vazamento.'],
  provocacao: 'E se um dos tripulantes pudesse sabotar a nave em segredo?',
};
```

- [ ] **Step 2: Escrever o teste que falha**

```js
// test/validador.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarKit } from '../src/validador.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

test('kit de exemplo passa sem avisos', () => {
  assert.deepEqual(validarKit(kitExemplo, entradaExemplo), []);
});

test('kit vazio ou malformado não quebra', () => {
  const avisos = validarKit({ cartas: 'abc' }, entradaExemplo);
  assert.ok(avisos.some(a => a.includes('"titulo"')));
  assert.ok(avisos.some(a => a.includes('"cartas"')));
  assert.doesNotThrow(() => validarKit(null, entradaExemplo));
});

test('turno longo demais para a dificuldade', () => {
  const k = { ...kitExemplo, turno: ['a', 'b', 'c', 'd'] };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('o limite é 3')));
  assert.deepEqual(validarKit(k, { ...entradaExemplo, dificuldade: 'medio' }), []);
});

test('número de tipos de carta fora de 4 a 12', () => {
  const k = { ...kitExemplo, cartas: kitExemplo.cartas.slice(0, 2) };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('entre 4 e 12')));
});

test('mais de 54 cartas físicas, contando quantidade em texto', () => {
  const k = { ...kitExemplo, cartas: kitExemplo.cartas.map(c => ({ ...c, quantidade: '10' })) };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('limite para imprimir é 54')));
});

test('texto de carta acima de 120 caracteres', () => {
  const k = { ...kitExemplo, cartas: [...kitExemplo.cartas, { nome: 'Longa', texto: 'x'.repeat(121), quantidade: 1 }] };
  assert.ok(validarKit(k, entradaExemplo).some(a => a.includes('"Longa"') && a.includes('121/120')));
});

test('usa material que a pessoa não tem', () => {
  const semDado = validarKit(kitExemplo, { ...entradaExemplo, materiais: ['papel', 'caneta'] });
  assert.ok(semDado.some(a => a.includes('"dado" não está nos materiais')));
  const semCaneta = validarKit(kitExemplo, { ...entradaExemplo, materiais: ['papel', 'dado'] });
  assert.ok(semCaneta.some(a => a.includes('"caneta" não está nos materiais')));
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: os testes do validador falham com `Cannot find module '.../src/validador.js'`.

- [ ] **Step 4: Implementar `validarKit` em `src/validador.js`**

Cada trava produz exatamente esta mensagem:

| Trava | Mensagem |
|---|---|
| `titulo`, `objetivo`, `fim`: string vazia ou ausente. `preparacao`, `turno`, `cartas`, `rodada`: array vazio ou não array | `Falta o campo "${campo}".` |
| `turno.length` > limite (`facil`: 3, `medio`: 5) | `O turno tem ${n} passos; para "${dificuldade}" o limite é ${max}.` |
| tipos de carta fora de 4..12 | `São ${n} tipos de carta; use entre 4 e 12.` |
| soma de `Number(quantidade) \|\| 1` > 54 | `São ${total} cartas; o limite para imprimir é 54 (6 folhas).` |
| `texto` com mais de 120 caracteres | `A carta "${nome}" tem texto longo demais (${len}/120) e não cabe impressa.` |
| sem `dado` nos materiais e `/\bdados?\b/i` em algum texto do kit | `O jogo usa dado, mas "dado" não está nos materiais.` |
| sem `caneta` nos materiais e `/\b(caneta\|l[aá]pis\|anot)/i` em algum texto do kit | `O jogo pede para anotar, mas "caneta" não está nos materiais.` |

Os "textos do kit" são `objetivo`, `preparacao`, `turno`, `fim`, `rodada` e o `texto` de cada carta. Se `kit` não for objeto, trate-o como `{}`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/validador.js test/kit-exemplo.js test/validador.test.js
git commit -m "feat: Módulo B — travas de equilíbrio do kit"
```

---

### Task 3: IA (`src/ia.js`): prompts, chamada à OpenRouter, avisos de falha

**Files:**
- Create: `src/ia.js`
- Test: `test/ia.test.js`

**Interfaces:**
- Consumes: `catalogo` (Task 1); `kitExemplo`, `entradaExemplo` (Task 2).
- Produces:
  - `MODELO_PADRAO = 'google/gemma-4-31b-it:free'`
  - `promptKit(entrada: Entrada, mecanicas: Mecanica[]): {role, content}[]`
  - `promptRevisao(entrada: Entrada, kit: Kit, relato: string, avisos: string[]): {role, content}[]`
  - `extrairJSON(texto: string): object`
  - `mensagemDeErro(status: number): string`
  - `chamarLLM({ chave, modelo, mensagens, semente }): Promise<Kit>`

- [ ] **Step 1: Escrever o teste que falha**

```js
// test/ia.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELO_PADRAO, promptKit, promptRevisao, extrairJSON, mensagemDeErro, chamarLLM } from '../src/ia.js';
import { catalogo } from '../src/mecanicas.js';
import { kitExemplo, entradaExemplo } from './kit-exemplo.js';

const texto = msgs => msgs.map(m => m.content).join('\n');
const resposta = (corpo, ok = true, status = 200) => async () => ({ ok, status, json: async () => corpo });

test('extrairJSON aceita cerca de markdown e texto em volta', () => {
  assert.deepEqual(extrairJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJSON('Aqui está: {"a":{"b":2}} espero que ajude'), { a: { b: 2 } });
});

test('extrairJSON falha com aviso em resposta cortada', () => {
  assert.throws(() => extrairJSON('{"a": [1, 2'), /formato inesperado/);
});

test('mensagemDeErro diz o que fazer', () => {
  assert.match(mensagemDeErro(401), /openrouter\.ai\/keys/);
  assert.match(mensagemDeErro(402), /:free/);
  assert.match(mensagemDeErro(404), /openrouter\/free/);
  assert.match(mensagemDeErro(429), /espere/i);
  assert.match(mensagemDeErro(503), /tente de novo/i);
});

test('promptKit leva tema, jogadores, duração, materiais, mecânicas e o formato', () => {
  const t = texto(promptKit(entradaExemplo, [catalogo[0], catalogo[3]]));
  for (const s of ['exploração espacial', '4 jogadores', '20 minutos', 'papel, caneta, dado',
                   catalogo[0].nome, catalogo[3].nome, 'combine', '"provocacao"', 'no máximo 3 passos'])
    assert.ok(t.includes(s), s);
});

test('promptRevisao leva o kit atual, o relato e as travas', () => {
  const t = texto(promptRevisao(entradaExemplo, kitExemplo, 'ficou fácil demais', ['aviso X']));
  for (const s of ['Oxigênio Zero', 'ficou fácil demais', 'aviso X', '"mudancas"']) assert.ok(t.includes(s), s);
});

test('chamarLLM envia chave, modelo e semente e devolve o kit', async () => {
  let pedido;
  globalThis.fetch = async (url, opts) => { pedido = { url, ...opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(kitExemplo) } }] }) }; };
  const kit = await chamarLLM({ chave: 'sk-or-x', modelo: MODELO_PADRAO, mensagens: [], semente: 42 });
  assert.equal(kit.titulo, 'Oxigênio Zero');
  assert.equal(pedido.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(pedido.headers.Authorization, 'Bearer sk-or-x');
  const corpo = JSON.parse(pedido.body);
  assert.equal(corpo.model, MODELO_PADRAO);
  assert.equal(corpo.seed, 42);
  assert.deepEqual(corpo.response_format, { type: 'json_object' });
});

test('chamarLLM transforma falhas em avisos legíveis', async () => {
  const args = { chave: 'x', modelo: 'm', mensagens: [], semente: 1 };
  globalThis.fetch = resposta({}, false, 401);
  await assert.rejects(chamarLLM(args), /openrouter\.ai\/keys/);
  globalThis.fetch = resposta({ error: { message: 'Provider returned error', code: 502 } });
  await assert.rejects(chamarLLM(args), /tente de novo/i);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(chamarLLM(args), /conexão/);
  globalThis.fetch = async () => { throw new DOMException('t', 'TimeoutError'); };
  await assert.rejects(chamarLLM(args), /90 segundos/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: os testes de IA falham com `Cannot find module '.../src/ia.js'`.

- [ ] **Step 3: Implementar `src/ia.js`**

**`promptKit` e `promptRevisao`** devolvem `[{ role: 'system', content }, { role: 'user', content }]`. O `system` é montado por uma função interna a partir de `entrada`, com este texto (o limite de passos é 3 para `facil` e 5 para `medio`):

```
Você é co-designer de jogos de cartas curtos na ferramenta MesaInventada.
Você propõe um protótipo revisável, não um jogo final equilibrado.
Responda SOMENTE com um objeto JSON, sem nada fora dele, neste formato:
{"titulo":"","objetivo":"","preparacao":[""],"turno":[""],"fim":"","cartas":[{"nome":"","texto":"","quantidade":1}],"rodada":[""],"provocacao":""}
Regras:
- Português do Brasil, frases curtas e concretas.
- Use só os materiais disponíveis. As cartas são de papel e só têm texto, sem imagens.
- "turno": no máximo ${limite} passos.
- "cartas": de 4 a 12 tipos; "texto" com até 120 caracteres; soma das "quantidade" até 54.
- "rodada": 3 a 6 passos simulando uma rodada de teste, com jogadores nomeados e valores concretos (ex.: "Ana rola o dado: 2").
- "provocacao": uma pergunta que desafia uma suposição deste jogo (ex.: precisa haver um vencedor?).
```

O `user` de `promptKit` tem estas linhas:

```
Tema: ${tema}
${jogadores} jogadores · ${duracao} minutos · dificuldade ${fácil|médio}
Materiais disponíveis: ${materiais.join(', ')}
```

Depois delas vem a linha `Mecânica escolhida (construa o jogo em torno dela):` quando há uma mecânica, ou `Mecânicas escolhidas (combine as duas num só jogo):` quando há duas. Por fim, uma linha `- ${nome}: ${descricao}` por mecânica.

O `user` de `promptRevisao` tem `Kit atual: ${JSON.stringify(kit)}`, `O que aconteceu no teste: ${relato}`, `Problemas apontados pelas travas: ${avisos.join('; ') || 'nenhum'}` e, por último, `Revise o kit para resolver isso, mudando o mínimo necessário. Devolva o kit completo no mesmo formato e acrescente "mudancas": ["o que mudou e por quê"].`

**`extrairJSON`** remove as cercas ```` ``` ````, aplica `JSON.parse` entre o primeiro `{` e o último `}` e, em caso de erro, lança `Error('A IA respondeu em um formato inesperado. Clique em CRIAR JOGO de novo ou troque o modelo em ⚙ Configurar.')`.

**`mensagemDeErro`** mapeia o status para estas mensagens:

| status | mensagem |
|---|---|
| 401 | `Chave inválida ou ausente. Abra ⚙ Configurar e cole sua chave da OpenRouter (openrouter.ai/keys).` |
| 402 | `Sua conta OpenRouter está sem créditos para este modelo. Use um modelo terminado em ":free".` |
| 404 | `Modelo não encontrado. Em ⚙ Configurar, use "openrouter/free" ou outro modelo ":free".` |
| 429 | `Limite de pedidos atingido (modelos grátis têm limite por minuto e por dia). Espere um minuto e tente de novo.` |
| ≥ 500 | `O provedor do modelo está fora do ar agora. Tente de novo em instantes ou troque o modelo.` |
| outro | `Erro inesperado (${status}). Tente de novo.` |

**`chamarLLM`** faz `fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: \`Bearer ${chave}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, seed, response_format: { type: 'json_object' } }), signal: AbortSignal.timeout(90_000) })` e trata o resultado assim:
- `TimeoutError` vira a mensagem `A IA demorou mais de 90 segundos. Tente de novo ou troque o modelo em ⚙ Configurar.`
- Qualquer outra exceção do `fetch` vira `Sem conexão com a OpenRouter. Verifique a internet e tente de novo.`
- `!res.ok` usa `mensagemDeErro(res.status)`.
- Um corpo 200 com `error` usa `mensagemDeErro(error.code)`.
- No caso normal, devolve `extrairJSON(choices[0].message.content)`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/ia.js test/ia.test.js
git commit -m "feat: integração com OpenRouter, prompts e avisos de falha"
```

---

### Task 4: A tela (formulário, mecânicas, configuração da chave, ajuda)

**Files:**
- Create: `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: `catalogo`, `escolherMecanicas` (Task 1); `MODELO_PADRAO` (Task 3).
- Produces (em `app.js`, usado pelas Tasks 5, 6 e 8):
  - `ler(chave: string, padrao: any): any` e `gravar(chave: string, valor: any): void`: wrappers de `localStorage` com try/catch, que devolvem `padrao` se falhar.
  - `lerFormulario(): Entrada`.
  - Estado global `projeto` (contrato acima) e `selecionadas: Mecanica[]` (1–2 itens).
  - IDs do DOM:
    - formulário: `#formulario`, `#tema`, `#jogadores`, `#duracao`, `input[name=material]`, `#exemplo`, `#mecanicas`, `#outras`, `#semente`, `input[name=dificuldade]`, `#criar`
    - configuração: `#abrir-config`, `#config` (`<dialog>`), `#chave`, `#modelo`
    - saídas: `#aviso` (`role="alert"`), `#saida`, `#kit`, `#travas`, `#cartas`, `#rodada`, `#provocacao`, `#historico`, `#impressao`

- [ ] **Step 1: `index.html` + `style.css` com a tela do protótipo**

Use uma tela com duas colunas a partir de 900 px e uma coluna abaixo disso. A **esquerda** segue a numeração do protótipo:
1. "1. Qual o tema?" (`#tema`, `required`, placeholder `jogo cooperativo sobre espaço...`).
2. "2. Quem vai jogar?" (`#jogadores`, number de 2 a 8, padrão 4) e `#duracao` (number de 10 a 90, passo 5, padrão 20, sufixo "min").
3. "materiais:" com papel (marcado e `disabled`), caneta e dado.
4. A caixa amarela `#exemplo` com o texto `exemplo: "cooperativo no espaço, 4 pessoas, 20 min"`.
5. "3. Escolha a mecânica" com `#mecanicas`, a dica `Escolha 1, ou 2 para combinar`, o botão `#outras` ("↻ outras mecânicas") e `semente <span id="semente">`.
6. "dificuldade [fácil | médio]" e o botão escuro `#criar` com o texto "CRIAR JOGO".

A **direita** tem `#aviso`, `#saida` (escondido até existir kit, com "saída 1: kit de regras (editável)" e "saída 2: folha A4 + rodada") e `#historico`. Fora das colunas fica `<section id="impressao">`, preenchida na Task 6.

O cabeçalho mostra "MesaInventada" e o botão `#abrir-config` ("⚙ Configurar IA"), seguidos de um `<details open>` "Como usar" com esta cópia:

> 1. Descreva o tema e quem vai jogar (ou clique no exemplo).
> 2. Escolha uma mecânica, ou duas para combinar. "↻ outras mecânicas" sorteia novas.
> 3. Clique em CRIAR JOGO. A IA escreve regras, cartas e uma rodada de teste, e tudo fica editável.
> 4. Jogue com papel, relate o que deu errado e peça uma revisão. Baixe o PDF para imprimir.
>
> **Onde a IA entra:** as mecânicas oferecidas vêm de um catálogo fixo, sem IA. A IA (um modelo de linguagem via OpenRouter) decide as regras, o texto das cartas, a rodada de teste e a provocação, e reescreve o kit a partir do seu relato. As travas, também sem IA, avisam quando o resultado foge dos limites. A última palavra é sua: dá para editar, apagar ou voltar a qualquer versão.

O `<dialog id="config">` traz esta cópia, depois `#chave` (`type=password`), `#modelo` (valor padrão `MODELO_PADRAO`) e os botões Salvar/Fechar:

> Para usar a IA você precisa de uma chave gratuita da OpenRouter:
> 1. Crie uma conta em openrouter.ai (dá para entrar com Google ou GitHub).
> 2. Abra openrouter.ai/keys e clique em "Create API Key".
> 3. Cole a chave abaixo. Modelos terminados em ":free" não cobram nada.
>
> A chave fica salva só neste navegador e é enviada apenas para a OpenRouter.

A paleta vem do protótipo: fundo creme `#f5efe2`, tinta `#2b2b2b`, nota amarela `#fdf1c4` (exemplo e rodada), mecânica selecionada em azul `#d6e6fb`, relatar em vermelho claro `#f8d7d7` e PDF em verde claro `#d9efd2`.

- [ ] **Step 2: Implementar a parte 1 do `app.js`**

Carregue `projeto` de `ler('mi:projeto', { sementeMecanicas: 1, atual: -1, versoes: [] })`. O `renderMecanicas()` mostra os cartões de `escolherMecanicas(lerFormulario(), projeto.sementeMecanicas)`, com nome e descrição, e roda no carregamento e a cada `change` de `#jogadores` ou dos materiais. Ele mantém em `selecionadas` só as mecânicas que continuam sendo oferecidas.

Um clique em um cartão alterna a seleção. Com 2 já selecionadas, o terceiro clique substitui a segunda. `#outras` incrementa `sementeMecanicas`, grava e chama `renderMecanicas()`. `#exemplo` preenche `jogo cooperativo sobre exploração espacial`, 4, 20, todos os materiais e `facil`. `#abrir-config` chama `showModal()`, e Salvar grava `mi:chave` e `mi:modelo`.

- [ ] **Step 3: Verificar no navegador**

Run: `python3 -m http.server 8000` (em background) e abra `http://localhost:8000`.

Expected:
- 3 cartões de mecânica, sem erros no console.
- Com "dado" desmarcado, "Forçar a sorte" e "Rolar e escrever" nunca aparecem em 10 cliques de ↻.
- O exemplo preenche o formulário.
- A chave salva sobrevive ao reload.
- **Review Focus 4:** com `localStorage` bloqueado (no Playwright, `page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } }))` seguido de reload), a página continua mostrando os 3 cartões sem erro no console.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: tela única com formulário, mecânicas, ajuda e configuração da chave"
```

---

### Task 5: CRIAR JOGO ponta a ponta (kit editável, travas, versões)

**Files:**
- Modify: `app.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `promptKit`, `chamarLLM` (Task 3); `validarKit` (Task 2); as interfaces de `app.js` da Task 4.
- Produces (em `app.js`):
  - `versaoAtual(): Versao | undefined`
  - `adicionarVersao(v: { origem, entrada, mecanicas, semente, kit, relato? }): void`: preenche `n` e `criadaEm`, faz `atual` apontar para ela e grava.
  - `gerar(mensagens, extras: { origem, entrada, mecanicas, relato? }): Promise<void>`: o fluxo carregando → chamada → `adicionarVersao({ ...extras, semente, kit })` → render, reutilizado pela Task 8.
  - `render(): void`: redesenha a versão atual, as travas e o histórico.
  - `renderKit(kit: Kit, alvo: HTMLElement, editavel: boolean): void`: reutilizado na comparação da Task 8.

- [ ] **Step 1: Ligar o submit de `#formulario` ao `gerar`**

1. `preventDefault`.
2. Se `selecionadas` estiver vazio, mostre `Escolha uma mecânica (ou duas para combinar).` em `#aviso`.
3. Se não houver `mi:chave`, chame `#config.showModal()` e pare. Nenhum `fetch` acontece.
4. Caso contrário: `gerar(promptKit(entrada, selecionadas), { origem: 'gerado', entrada, mecanicas: selecionadas })`.

O `gerar` segue esta ordem:
1. Retorna na hora se já estiver carregando.
2. Desabilita `#criar` e mostra o texto `Criando… ${s} s`, atualizado a cada 1 s.
3. Sorteia `semente = Math.floor(Math.random() * 1e6)`.
4. Chama `chamarLLM({ chave, modelo: ler('mi:modelo', MODELO_PADRAO), mensagens, semente })` e, depois, `adicionarVersao` e `render()`.
5. No `catch`, coloca `e.message` em `#aviso`.
6. No `finally`, restaura o botão.

`render()` limpa o `#aviso` quando dá certo.

- [ ] **Step 2: Escrever `renderKit`**

Monte o kit dentro de `alvo`:
- `titulo` como `<h2>`.
- Objetivo, Preparação (`<ol>`), Turno (`<ol>`), Fim e "Provocação" (destacada com ❓).
- Cartas como uma grade de cartões com nome, texto e `×quantidade`.
- "rodada teste" numa nota amarela.

Todo campo de texto é `contentEditable = editavel` e carrega `data-caminho` (`objetivo`, `turno.2`, `cartas.1.texto`, `cartas.1.quantidade`...). Proteja cada array com `Array.isArray(x) ? x : []` e cada string com `String(x ?? '')`. Quando `editavel` for verdadeiro, cada carta ganha um botão ✕ e a grade termina com um botão "+ carta", que adiciona `{ nome: 'Nova carta', texto: 'Escreva o efeito', quantidade: 1 }`.

- [ ] **Step 3: Edição**

Um único listener `input` em `#saida` lê `data-caminho`, escreve o `textContent` no kit da versão atual (com `Number()` quando a chave é `quantidade`), grava e redesenha só `#travas`. Não use `render()` aqui, para o cursor não pular. ✕ e "+ carta" alteram `kit.cartas` e chamam `render()`. Neste MVP, editar altera a versão atual no lugar.

- [ ] **Step 4: Travas na tela**

`#travas` lista `validarKit(kit, versaoAtual().entrada)` com o título `Travas: o que conferir antes de imprimir` e fica escondido quando a lista está vazia.

- [ ] **Step 5: Verificar no navegador com a OpenRouter simulada**

No Playwright, antes de clicar, rode `page.route('https://openrouter.ai/api/v1/chat/completions', r => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { choices: [{ message: { content: JSON.stringify(KIT) } }] } }))`, com `KIT` = `kitExemplo` de `test/kit-exemplo.js`.

Expected:
- **Caminho feliz:** com uma chave falsa salva, exemplo + 1 mecânica + CRIAR JOGO mostram "Oxigênio Zero", as 6 cartas, 3 passos de rodada, a provocação e nenhuma trava. Editar o texto de uma carta e recarregar mantém a edição.
- **Review Focus 1:** com o `KIT` = `{ "titulo": "X", "cartas": "abc" }`, a tela mostra "X" e as travas listam os campos faltando, sem erro no console.
- **Review Focus 2:** sem chave, o clique abre `#config` e não aparece nenhum request para openrouter.ai.
- **Review Focus 3:** com a rota respondendo após 2 s e dois cliques seguidos em CRIAR JOGO, o resultado é uma única versão (`projeto.versoes.length === 1`).
- Com a rota em `r.fulfill({ status: 429, headers: {'access-control-allow-origin': '*'}, body: '{}' })`, `#aviso` mostra a mensagem de limite.

Um teste real só é possível se o usuário fornecer uma chave. Caso contrário, ele fica para a Task 7, passo 3.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html style.css
git commit -m "feat: CRIAR JOGO ponta a ponta com kit editável, travas e versões"
```

---

### Task 6: Módulo C (Print & Play A4)

**Files:**
- Modify: `app.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `versaoAtual`, `render` (Task 5).
- Produces: `renderImpressao(kit: Kit): void` em `app.js`, chamado no fim de `render()` e após cada edição do passo 3 da Task 5.

- [ ] **Step 1: Escrever `renderImpressao`**

Preencha `#impressao` com duas coisas:
- Uma `.pagina` de regras: título, objetivo, preparação, turno e fim.
- Páginas `.pagina` com 9 cartas cada. Cada carta é repetida `Math.min(Number(quantidade) || 1, 20)` vezes. Cada `.carta-impressa` mostra o nome em negrito, o texto e, no rodapé, o título do jogo em letra pequena.

- [ ] **Step 2: CSS de impressão em `style.css`**

```css
@page { size: A4; margin: 10mm; }
@media screen { #impressao { display: none; } }
@media print {
  body > :not(#impressao) { display: none !important; }
  #impressao { display: block; }
  .pagina { break-after: page; }
  .grade-cartas { display: grid; grid-template-columns: repeat(3, 63mm); grid-auto-rows: 88mm; }
  .carta-impressa { border: 1px dashed #999; padding: 4mm; overflow: hidden; box-sizing: border-box; }
}
```

- [ ] **Step 3: Botão `#baixar-pdf`**

Coloque o botão verde "baixar PDF" ao lado da rodada, com a dica `Na janela de impressão, escolha "Salvar como PDF".` O clique chama `window.print()`.

- [ ] **Step 4: Verificar**

Com o `kitExemplo` (20 cartas físicas), a pré-visualização de impressão do Chrome deve mostrar 4 páginas A4: 1 de regras e 3 de cartas (9 + 9 + 2), em uma grade 3×3 com bordas tracejadas, sem nada da interface. No Playwright, use `browser_emulate_media` com `print` e tire um screenshot.

**Review Focus 5:** edite uma carta para ter 300 caracteres. O texto fica cortado dentro da carta e a trava de 120 caracteres aparece na tela.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html style.css
git commit -m "feat: Módulo C — Print & Play A4 via impressão do navegador"
```

---

### Task 7: Publicar, README e entrega do Checkpoint 1

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: o app completo das Tasks 1 a 6.

- [ ] **Step 1: Escrever `README.md`**

Use estas seções, nesta ordem:
1. **O que é:** uma frase do relatório 4.3.
2. **Usar online:** link do GitHub Pages.
3. **Como conseguir a chave:** os mesmos 3 passos do diálogo.
4. **Rodar localmente:** `python3 -m http.server 8000` e abrir `http://localhost:8000`. Abrir o arquivo direto (`file://`) não funciona por causa dos ES modules.
5. **Testes:** `npm test`.
6. **Onde a IA entra e o que ela decide:** o mesmo texto da tela.
7. **Mapa do diagrama para o código:** Módulo A → `src/mecanicas.js`; API externa → `src/ia.js`; Módulo B → `src/validador.js`; Módulo C → `#impressao` + `@media print`; banco SQLite → `localStorage`; templates das cartas → `.carta-impressa`.
8. **Mudanças registradas em relação ao diagrama e ao protótipo:**
   - SQLite foi trocado por localStorage, porque o site estático não tem servidor.
   - O PDF sai pela impressão do navegador.
   - Dá para combinar 2 mecânicas.
   - A IA devolve uma provocação.
   - A dificuldade limita os passos do turno.

- [ ] **Step 2: Publicar no GitHub Pages (ação do grupo)**

```bash
git add README.md && git commit -m "docs: README com passo a passo, onde a IA entra e mudanças registradas"
# no github.com: criar o repositório público "mesainventada" (vazio)
git remote add origin https://github.com/<usuario>/mesainventada.git
git push -u origin main
```

Depois, no GitHub: Settings → Pages → Source "Deploy from a branch" → `main` / `(root)` → Save.
Expected: em cerca de 1 minuto, `https://<usuario>.github.io/mesainventada/` abre a tela.

- [ ] **Step 3: Teste real na URL publicada, com uma chave verdadeira**

Faça o fluxo completo: exemplo → CRIAR JOGO → kit em menos de 60 s → editar uma carta → baixar PDF.
Expected: kit coerente, sem travas ou com travas compreensíveis, e um PDF de 4 a 7 páginas. Se o modelo padrão falhar ou ficar lento, troque `MODELO_PADRAO` pelo modelo `:free` que funcionou e registre a troca no README.

- [ ] **Step 4: Entregar o PF 4 no Classroom**

Envie o link publicado, o link do repositório e uma frase sobre onde a IA entra.

---

### Task 8: Revisar a partir do relato, histórico e comparação lado a lado

**Files:**
- Modify: `app.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `promptRevisao` (Task 3); `validarKit` (Task 2); `gerar`, `versaoAtual`, `renderKit`, `render` (Task 5).

- [ ] **Step 1: Relatar dificuldade**

O botão vermelho "relatar dificuldade" (`#relatar`) abre `#relato-box`, que tem um `<textarea id="relato">` com o placeholder `O que aconteceu no teste? Ex.: acabou em 5 minutos, ninguém usou as cartas de troca...` e o botão `#revisar` ("Revisar com IA").

`#revisar` exige relato não vazio e chama:

`gerar(promptRevisao(v.entrada, v.kit, relato, validarKit(v.kit, v.entrada)), { origem: 'revisado', entrada: v.entrada, mecanicas: v.mecanicas, relato })`

Aqui `v = versaoAtual()`. A revisão usa a entrada da versão, não o formulário. Se o kit tiver `mudancas`, renderize a lista "O que mudou" acima das regras.

- [ ] **Step 2: Corrigir travas**

O botão `#corrigir` ("Pedir à IA para corrigir"), dentro de `#travas`, faz o mesmo fluxo com o relato `Corrija os problemas apontados pelas travas.`

- [ ] **Step 3: Histórico e comparação**

`#historico` lista as versões da mais nova para a mais antiga, no formato `v${n} · ${origem} · ${hora}`, com a semente num `title`. A versão atual fica marcada. Cada item tem dois botões:
- "abrir": `projeto.atual = i`, grava e chama `render()`.
- "comparar": mostra `#comparacao` com duas colunas, `renderKit(v.kit, colunaA, false)` e `renderKit(versaoAtual().kit, colunaB, false)`, mais o botão "fechar comparação".

- [ ] **Step 4: Verificar no navegador**

Use a rota simulada da Task 5. Depois de gerar a v1, troque a rota para devolver `{ ...kitExemplo, titulo: 'Oxigênio Zero 2', mudancas: ['Turno mais curto'] }`.

Expected:
- Relatar "acabou rápido" e clicar em Revisar mostra "Oxigênio Zero 2" e "O que mudou: Turno mais curto".
- O histórico mostra v2 · revisado e v1 · gerado.
- "abrir" na v1 volta a mostrar "Oxigênio Zero".
- "comparar" mostra as duas lado a lado.
- Recarregar a página mantém o histórico.

- [ ] **Step 5: Commit e publicar**

```bash
git add app.js index.html style.css
git commit -m "feat: revisão por relato pós-teste, histórico e comparação lado a lado"
git push
```

---

## Depois do checkpoint (12/11 → 17/11), fora deste plano

- **12/11:** entregar a URL a alguém de fora do grupo e observar em silêncio. Cada dúvida que surgir vira um texto na tela.
- Se a chave própria atrapalhar a Cruzada, adicionar um proxy com a chave do grupo (Cloudflare Worker).
- Trocar os cartões genéricos do catálogo por 3 conceitos temáticos gerados pela IA (como "oxigênio / reparo / setores" no protótipo).
- Edição manual gerar uma versão nova, em vez de alterar a versão atual.
