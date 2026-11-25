# MesaInventada

Ferramenta de cocriação de jogos de cartas curtos. Você parte de um tema, uma experiência desejada ou uma ideia incompleta e desenvolve o jogo com apoio da IA: compara mecânicas, combina, edita as regras, testa com papel e revisa a partir do que aconteceu na mesa.

Projeto Ferramenta, Criatividade Computacional 2026.2.

## Usar online

**https://josiasnetto.github.io/mesainventada/**

Tudo funciona no navegador, numa tela só. Não precisa instalar nada.

## Rodar localmente

O projeto é um site estático em HTML, CSS e JavaScript puro: não tem build, `npm install` nem dependências. Basta servir a pasta com qualquer servidor HTTP e abrir no navegador.

### O que você precisa

| Para | Precisa de |
|---|---|
| Usar a ferramenta | um navegador atualizado (Chrome, Edge, Firefox ou Safari) e um servidor HTTP local (o do Python já serve) |
| Rodar os testes | [Node.js](https://nodejs.org) 22 ou mais novo |
| Gerar jogos com IA | uma chave da OpenRouter (gratuita) ou da OpenAI (paga), veja [Configurar a chave da IA](#configurar-a-chave-da-ia) |

### Passo a passo

1. Baixe o código e entre na pasta:

   ```bash
   git clone https://github.com/JosiasNetto/mesainventada.git
   cd mesainventada
   ```

2. Suba um servidor local na raiz do projeto (a pasta onde está o `index.html`):

   ```bash
   python3 -m http.server 8000
   ```

   No Windows, use `python -m http.server 8000`. Sem Python, com Node instalado, `npx serve -l 8000` também funciona.

3. Abra **http://localhost:8000** no navegador.

4. Clique em **⚙ Configurar IA**, cole sua chave e clique em **Salvar**.

5. Preencha o tema, escolha uma mecânica (ou clique no exemplo) e clique em **CRIAR JOGO**.

Para parar o servidor, volte ao terminal e aperte `Ctrl+C`.

### Configurar a chave da IA

A ferramenta usa a chave da própria pessoa. Ela fica salva só no seu navegador (`localStorage`) e é enviada apenas para o provedor dela. O tipo de chave decide o provedor:

| | OpenRouter | OpenAI |
|---|---|---|
| Onde criar | [openrouter.ai/keys](https://openrouter.ai/keys) → "Create API Key" | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → "Create new secret key" |
| A chave começa com | `sk-or-v1-` | `sk-` ou `sk-proj-` |
| Custo | modelos terminados em `:free` não cobram nada | pago por uso; um kit com a avaliação da rubrica custa cerca de US$ 0,004 |
| Modelo de texto padrão | `nvidia/nemotron-3.5-super-vl:free` | `gpt-5-mini` |
| Modelo de imagem padrão | `google/gemini-3.1-flash-lite-image` (pago) | `gpt-image-1-mini` |

Copie a chave inteira na hora em que ela é criada: os sites só a mostram uma vez, e a lista de chaves exibe só um pedaço. Em ⚙ Configurar IA, deixe os campos de modelo em branco para usar os padrões (indicados em cinza) e desligue "Gerar ilustrações das cartas com IA" se não quiser gerar imagens.

Com a OpenRouter, se o modelo escolhido estiver saturado ou fora do ar, ela tenta sozinha as reservas gratuitas (`openrouter/free` e `google/gemma-4-31b-it:free`). Modelos grátis mudam com frequência: se algum sumir, troque em ⚙ Configurar IA ou em `src/ia.js`.

### Testes

```bash
npm test
```

Roda `node --test test/*.test.js` com o Node 22+. Os testes não chamam nenhuma API (as respostas da IA são simuladas) e não precisam de chave.

### Benchmark de tempo e custo (opcional)

O script `scripts/benchmark-openai.js` faz chamadas reais à OpenAI e mede tempo, tokens e custo dos modelos de texto e imagem. Ele gasta créditos da sua conta (cerca de US$ 0,20 por rodada). Crie um arquivo `.env` na raiz, que o git ignora:

```bash
echo "OPENAI_API_KEY=sk-proj-..." > .env
node scripts/benchmark-openai.js
```

Os resultados saem no terminal e em `scripts/resultados-benchmark-openai.json`. A análise está em `docs/avaliacao-tempo-custo.md`.

### Problemas comuns

- **Abri o `index.html` com dois cliques e a página não funciona.** Pelo endereço `file://` o navegador bloqueia os módulos JavaScript. Abra sempre pelo servidor, em `http://localhost:8000`.
- **`Address already in use`.** A porta 8000 está ocupada. Use outra, por exemplo `python3 -m http.server 8080`, e abra `http://localhost:8080`.
- **Mudei o código e nada mudou na tela.** O navegador pode estar usando arquivos antigos do cache. Recarregue com `Ctrl+Shift+R` (`Cmd+Shift+R` no Mac).
- **"Essa não parece uma chave completa".** A chave foi copiada pela metade, provavelmente da lista de chaves do site. Crie uma nova e copie pelo botão de copiar.
- **Quero começar do zero.** Os projetos e a chave ficam no `localStorage` do navegador. Para apagar tudo, abra as ferramentas de desenvolvedor (`F12`) → Application/Armazenamento → Local Storage → `http://localhost:8000` → Clear.

## Onde a IA entra e o que ela decide

- **Sem IA:** o catálogo de mecânicas é fixo e completo, organizado em famílias (cooperativo, competitivo, informação oculta, negociação, sorte). A pessoa vê todas as opções num modal e escolhe até cinco para combinar. As **travas** também não usam IA: conferem passos do turno, quantidade e tamanho das cartas e materiais usados.
- **Com IA** (modelo de linguagem via OpenRouter):
  - decide as regras (objetivo, preparação, turno, fim), o texto e a quantidade das cartas, uma rodada de teste simulada e uma **provocação** que questiona uma suposição do jogo;
  - gera sob demanda as **ilustrações das cartas** (individualmente ou para todas as cartas do kit de uma vez), integradas à visualização na tela e ao PDF Print & Play;
  - na revisão, reescreve o kit a partir do relato do teste e explica o que mudou.
- **A pessoa decide** o tema (com quantos detalhes quiser), o público, os materiais (inclusive outros escritos à mão), qual mecânica usar (ou até cinco combinar), a dificuldade e se/quando ilustrar cada carta. Também pode editar qualquer texto, apagar e criar cartas, trocar ou remover ilustrações, voltar a qualquer versão, comparar versões e consultar o tempo e o custo de cada artefato.

## Mapa do diagrama para o código

| Diagrama (caixa transparente) | Código |
|---|---|
| Formulário | `index.html` + `app.js` |
| Módulo A: motor de mecânicas + catálogo de mecânicas | `src/mecanicas.js` |
| Catálogo de jogos existentes e regras passadas | `src/jogos-referencia.json` + `src/referencias.js` |
| API externa LLM e Imagem: regras, cartas, rodada e ilustrações | `src/ia.js` |
| Avaliação de tempo, tokens e custo do artefato | `src/custos.js` + `docs/avaliacao-tempo-custo.md` |
| Módulo B: validador de equilíbrio + travas | `src/validador.js` |
| Módulo C: gerador de PDF A4 + templates das cartas | `renderImpressao` em `app.js` + `@media print` em `style.css` |
| Banco SQLite: projetos e componentes | `localStorage` do navegador (`mi:projeto`) |
| Relato pós-teste | botão "relatar dificuldade" → revisão pela IA |

## Mudanças registradas em relação ao diagrama e ao protótipo

- **SQLite → localStorage.** O site é estático (GitHub Pages) e não tem servidor. Por isso o histórico de versões fica no navegador de quem usa.
- **PDF pela impressão do navegador.** "baixar PDF" abre a impressão já formatada em A4 (regras numa folha, cartas 63×88 mm em 3×3 com linhas de corte). Basta escolher "Salvar como PDF".
- **Combinar até cinco mecânicas.** O protótipo escolhia uma. Agora dá para escolher até cinco e a IA as combina num só jogo.
- **Catálogo completo de mecânicas.** Em vez de três opções sorteadas, um modal mostra todo o catálogo por família, com indicação das que não combinam com os jogadores ou materiais atuais.
- **Outros materiais.** Além de papel, caneta e dado, a pessoa pode escrever materiais extras; eles entram no prompt e nas travas.
- **Tema em caixa ampla.** O campo de tema virou uma caixa de texto que cresce com o conteúdo, no estilo dos chats de LLM, para receber quantos detalhes forem necessários.
- **Provocação.** A IA devolve uma pergunta que desafia uma suposição do jogo, conforme o compromisso de "incorporar provocações e contrapontos" do relatório.
- **Dificuldade limita o turno.** "fácil" permite no máximo 3 passos no turno (direto e intuitivo), e "médio" permite no máximo 5 passos (decisões táticas e sinergias).
- **Modo Livre vs. Modo Guiado.** Dá a opção de escolher entre criação guiada (paramétrica, escolhendo mecânicas e restrições) ou criação livre (prompt aberto, onde a IA deduz dinâmicas, jogadores ideais e materiais a partir da narrativa).
- **Opção de Tabuleiro em folha A4.** Possibilidade de criar jogos com tabuleiro (trilhas de casas ou setores) integrado às cartas e regras, com impressão diagramada para Print & Play.
- **Chave da própria pessoa (BYOK).** Não há chave do grupo embutida, e a tela explica como obter uma chave gratuita.
- **Jogadores de 1 a 8.** O formulário, o filtro de mecânicas, o prompt e as travas tratam desde modo solo (1 pessoa) até mesas maiores (8 pessoas), avisando quando alguma mecânica deixa de ser compatível.
- **Ilustrações de cartas sob demanda.** Cada carta tem um botão para gerar ou trocar sua ilustração via OpenRouter (`openai/gpt-5-image-mini` / `google/gemini-3.1-flash-lite-image`), além do botão "Ilustrar todas as cartas", com compactação automática em JPEG para caber no `localStorage` e impressão no PDF A4.
- **Avaliação de tempo e custo por artefato.** A ferramenta mede o tempo de resposta, os tokens de entrada/saída/imagem e o custo em US$ e R$ de cada versão (texto + imagens), exibindo na tela, no histórico de versões e no relatório técnico em `docs/avaliacao-tempo-custo.md`.
