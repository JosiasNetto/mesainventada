# MesaInventada

Ferramenta de cocriação de jogos de cartas curtos. Você parte de um tema, uma experiência desejada ou uma ideia incompleta e desenvolve o jogo com apoio da IA: compara mecânicas, combina, edita as regras, testa com papel e revisa a partir do que aconteceu na mesa.

Projeto Ferramenta, Criatividade Computacional 2026.2.

## Usar online

**https://josiasnetto.github.io/mesainventada/**

Tudo funciona no navegador, numa tela só. Não precisa instalar nada.

## Como conseguir a chave da IA

A ferramenta usa a chave da própria pessoa na OpenRouter, que tem modelos gratuitos:

1. Crie uma conta em [openrouter.ai](https://openrouter.ai) (dá para entrar com Google ou GitHub).
2. Abra [openrouter.ai/keys](https://openrouter.ai/keys) e clique em "Create API Key". Copie a chave inteira na hora (começa com `sk-or-v1-`): ela só aparece uma vez, e a lista de chaves mostra só um pedaço.
3. Na MesaInventada, clique em **⚙ Configurar IA** e cole a chave. Modelos terminados em `:free` não cobram nada.

A chave fica salva só no seu navegador e é enviada apenas para a OpenRouter. O modelo padrão é `nvidia/nemotron-3.5-super-vl:free`. Se o modelo escolhido estiver saturado ou fora do ar, a OpenRouter tenta sozinha as reservas gratuitas (`openrouter/free` e `google/gemma-4-31b-it:free`). Modelos grátis mudam com frequência: se algum sumir, troque em ⚙ Configurar IA ou em `src/ia.js`.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` direto pelo arquivo (`file://`) não funciona, porque os módulos JavaScript precisam de um servidor.

## Testes

```bash
npm test   # Node 22+, sem dependências
```

## Onde a IA entra e o que ela decide

- **Sem IA:** o catálogo de mecânicas é fixo e completo, organizado em famílias (cooperativo, competitivo, informação oculta, negociação, sorte). A pessoa vê todas as opções num modal e escolhe até cinco para combinar. As **travas** também não usam IA: conferem passos do turno, quantidade e tamanho das cartas e materiais usados.
- **Com IA** (modelo de linguagem via OpenRouter):
  - decide as regras (objetivo, preparação, turno, fim), o texto e a quantidade das cartas, uma rodada de teste simulada e uma **provocação** que questiona uma suposição do jogo;
  - na revisão, reescreve o kit a partir do relato do teste e explica o que mudou.
- **A pessoa decide** o tema (com quantos detalhes quiser), o público, os materiais (inclusive outros escritos à mão), qual mecânica usar (ou até cinco combinar) e a dificuldade. Também pode editar qualquer texto, apagar e criar cartas, voltar a qualquer versão e comparar duas versões lado a lado.

## Mapa do diagrama para o código

| Diagrama (caixa transparente) | Código |
|---|---|
| Formulário | `index.html` + `app.js` + `src/jogadores.js` |
| Módulo A: motor de mecânicas + catálogo de mecânicas | `src/mecanicas.js` |
| Catálogo de jogos existentes e regras passadas | `src/referencias.js` |
| API externa LLM: regras, cartas e rodada | `src/ia.js` |
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
- **Dificuldade limita o turno.** "fácil" permite no máximo 3 passos no turno, e "médio" permite no máximo 5.
- **Chave da própria pessoa (BYOK).** Não há chave do grupo embutida, e a tela explica como obter uma chave gratuita.
- **Jogadores de 1 a 8.** O formulário, o filtro de mecânicas, o prompt e as travas tratam desde modo solo (1 pessoa) até mesas maiores (8 pessoas), avisando quando alguma mecânica deixa de ser compatível.
- **Jogos existentes e regras passadas.** Além de criar do zero, a pessoa pode partir de jogos mapeados (`src/referencias.js`), versões anteriores da sessão ou regras coladas para gerar novas cartas, variações de regras ou novos jogos inspirados.
