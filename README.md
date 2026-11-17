# MesaInventada

Ferramenta de cocriação de jogos de cartas curtos. Você parte de um tema, uma experiência desejada ou uma ideia incompleta e desenvolve o jogo com apoio da IA: compara mecânicas, combina, edita as regras, testa com papel e revisa a partir do que aconteceu na mesa.

Projeto Ferramenta, Criatividade Computacional 2026.2.

## Usar online

**https://josiasnetto.github.io/mesainventada/**

Tudo funciona no navegador, numa tela só. Não precisa instalar nada.

## Como conseguir a chave da IA

A ferramenta usa uma chave da OpenAI (`sk-...` ou `sk-proj-...`), a mesma para texto e imagens:

1. Crie uma conta em [platform.openai.com](https://platform.openai.com) e configure um método de pagamento.
2. Abra [platform.openai.com/api-keys](https://platform.openai.com/api-keys) e clique em "Create new secret key". Copie a chave inteira na hora: ela só aparece uma vez.
3. Na MesaInventada, clique em **⚙ Configurar IA** e cole a chave.

A chave fica salva só no seu navegador e é enviada apenas para a API da OpenAI (`https://api.openai.com`). O texto usa `gpt-5-mini` em `https://api.openai.com/v1/chat/completions` e as ilustrações usam `gpt-image-1-mini` em `https://api.openai.com/v1/images/generations` (JPEG, qualidade `low`). Chaves de outros provedores não são aceitas.

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
- **Com IA** (modelo de linguagem `gpt-5-mini` via OpenAI):
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
- **Chave da própria pessoa (BYOK).** Não há chave do grupo embutida, e a tela explica como obter uma chave da OpenAI.
- **Jogadores de 1 a 8.** O formulário, o filtro de mecânicas, o prompt e as travas tratam desde modo solo (1 pessoa) até mesas maiores (8 pessoas), avisando quando alguma mecânica deixa de ser compatível.
- **Ilustrações de cartas sob demanda.** Cada carta tem um botão para gerar ou trocar sua ilustração com a **mesma chave OpenAI** dos artefatos de texto, usando `gpt-image-1-mini` (JPEG, qualidade `low`). Há também o botão "Ilustrar todas as cartas", com compactação automática em JPEG para caber no `localStorage` e impressão no PDF A4.
- **Avaliação de tempo e custo por artefato.** A ferramenta mede o tempo de resposta, os tokens de entrada/saída/imagem e o custo em US$ e R$ de cada versão (texto + imagens), exibindo na tela, no histórico de versões e no relatório técnico em `docs/avaliacao-tempo-custo.md`.
