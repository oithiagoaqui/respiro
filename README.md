# FIO — guarde o fio para depois

Protótipo web funcional do App 2 — versão 8.

## Conceito

O FIO é uma memória externa para não perder o fio de uma tarefa. A pessoa cria uma tarefa, divide o caminho em etapas, trabalha, registra onde parou e depois volta exatamente ao ponto necessário.

## O que esta versão faz

- Primeiro uso começa vazio, sem tarefa de demonstração.
- Se existir um ponto de parada salvo, o FIO abre diretamente na tela **“Você estava aqui.”** na próxima abertura.
- Timeline vertical de etapas, com um elemento visual de fio/espiral.
- A timeline é vertical e pode ser percorrida por rolagem normal; não há gesto de arrastar a linha para mudar de etapa.
- Tocar na etapa atual conclui essa etapa e avança o fio.
- Indicador de etapa atual atualizado em tempo real (ex.: Etapa 2/6).
- **Concluir tarefa** arquiva a tarefa na aba **Concluídas**, preservando todos os dados.
- Tarefas concluídas podem ser consultadas, reabertas ou excluídas separadamente.
- **Parei aqui** salva o contexto para uma retomada orientada.
- **Clonar tarefa** cria uma cópia limpa da tarefa.
- **Excluir tarefa** remove a tarefa após confirmação.
- Dados locais no navegador, sem login e sem banco externo.
- Exportação e importação em JSON.
- PWA com service worker.
- Pronto para publicação na Vercel.

## Arquitetura

- HTML/CSS/JavaScript puro
- Sem backend
- Sem login
- Sem banco de dados externo
- `localStorage` para os dados
- Exportação/importação em JSON
- Service worker para recursos da aplicação

## Rodar localmente

Abra `index.html` para uma prévia simples.

Para testar o modo PWA/offline de forma completa, use um servidor local, por exemplo:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Publicar no GitHub + Vercel

1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. No Vercel, escolha **Add New Project**.
4. Importe o repositório.
5. Framework Preset: **Other**.
6. Build Command: vazio.
7. Output Directory: `.`.
8. Deploy.

A Vercel passa a publicar cada alteração enviada ao GitHub.

## Dados e backup

Os dados são guardados localmente no navegador. O FIO não precisa de uma conta ou banco remoto.

Como esses dados podem ser perdidos se os dados/cache do navegador forem apagados, é recomendado exportar um backup de tempos em tempos. O arquivo gerado se chama aproximadamente:

`fio-backup-AAAA-MM-DD.json`

Normalmente ele ficará na pasta **Downloads** do computador ou celular.

## Retomada

Ao usar **Parei aqui**, o FIO salva a etapa atual, a observação e o momento da parada. Na próxima abertura, se houver uma tarefa interrompida, ela vira a primeira tela: **“Você estava aqui.”**

## Próximas evoluções

- animação da timeline/fio mais refinada
- reorganização das etapas por arrastar
- múltiplas tarefas dentro de projetos com agrupamento mais elaborado
- histórico de pontos de parada
- edição de nomes e etapas
- confirmação de importação mais detalhada
- ícones e identidade visual próprios
- testes em Android/iOS


## Usar como aplicativo no celular

O FIO é preparado como **PWA (Progressive Web App)**.

Isso significa que, depois de publicado em um endereço HTTPS:

- o navegador pode oferecer **Instalar aplicativo** / **Adicionar à tela inicial**;
- Android usa o ícone `icons/icon-512.png` / `icons/icon-192.png`;
- iPhone/iPad usa `icons/apple-touch-icon-180.png`;
- o nome exibido é **FIO**;
- a abertura instalada usa `display: standalone`, aproximando a experiência de um app;
- o service worker permite que a interface continue disponível offline depois de carregada;
- os dados continuam no armazenamento local do navegador/dispositivo.

### Observação importante

“Adicionar à tela inicial” não transforma o site em um aplicativo nativo. O FIO continua sendo uma aplicação web, mas passa a se comportar visualmente muito mais como um app. Para esta fase do projeto, essa é a abordagem intencional.


## Versão 4 — UX enxuta
- Primeiro uso começa sem tarefa e sem etapas sugeridas.
- Nenhuma etapa é pré-cadastrada ao criar uma tarefa.
- **Concluir etapa** e **Parei aqui** ficam no topo da tarefa.
- A evolução usa uma timeline vertical com um fio visual.
- **Clonar** e **Excluir** ficam na lista geral de tarefas.
- A interface foi compactada para reduzir rolagem.
### Ícones Android e iOS

- Android/PWA: `icon-192-maskable.png` e `icon-512-maskable.png` usam arte final adequada para ícone adaptativo, com a marca dentro da área segura.
- Android/PWA (ícone normal): `icon-192.png` e `icon-512.png`.
- iOS/iPadOS: `apple-touch-icon-180.png`, referenciado no HTML. O arquivo é full-bleed para que o sistema aplique o recorte arredondado.

O manifest separa explicitamente os propósitos `any` e `maskable`.


## Versão 6 — navegação
- Removido o gesto de arrastar a linha/timeline para evitar confusão na tela.
- As etapas continuam acessíveis por toque direto.
- Botão **Início** fica sempre disponível no cabeçalho.
- A barra inferior mantém acesso direto a **Tarefas** e **Dados**.
- O histórico de navegação do próprio FIO usa a History API, permitindo que o botão **Voltar** do Android retorne à tela anterior do FIO em vez de sair imediatamente da aplicação.
- Ao chegar à página inicial, o comportamento de voltar volta a ser o comportamento normal do navegador/sistema.


## Versão 7 — fluxo de tarefa mais direto
- A observação deixada em **Parei aqui** aparece em destaque na tela de retomada, antes das demais informações.
- **Parei aqui** fica no topo da tela da tarefa, antes da timeline de etapas.
- Removido o botão separado de **Concluir etapa**. Para manter a função sem ocupar espaço, tocar na etapa atual a conclui e faz o fio avançar; tocar em outra etapa apenas muda o ponto selecionado.
- Removida a rolagem interna da timeline: a página usa a rolagem normal do dispositivo.
- A timeline ficou mais compacta para reduzir a necessidade de rolar.
- O acesso a **Início** ficou maior e mais visível nas telas de tarefa e retomada.

## Versão 8 — indicador de etapa e tarefas concluídas
- O indicador no topo da tarefa mostra a etapa selecionada/atual em relação ao total (ex.: `Etapa 2/6`) e a quantidade concluída.
- Tarefas antigas sem o campo `completed` continuam sendo consideradas em andamento.
- O botão **Concluir tarefa** permite arquivar uma tarefa inteira. Se houver etapas pendentes, o FIO pede confirmação antes de concluir mesmo assim.
- A lista de tarefas tem abas **Em andamento** e **Concluídas**.
- Tarefas concluídas permanecem salvas e podem ser consultadas, reabertas ou excluídas.
- A chave local `fio-data-v2` e o formato-base dos dados foram preservados para manter compatibilidade com os registros existentes.
