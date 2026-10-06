# Respiro — protótipo web + APK offline

O Respiro é um protótipo de apoio à regulação emocional. Esta versão foi preparada para publicação na web via **GitHub + Vercel**, sem autenticação, login, banco de dados ou envio dos registros pessoais para um servidor.

## Privacidade e armazenamento local

A aplicação pode ser acessada pela internet, mas os dados criados pela pessoa ficam no próprio navegador/dispositivo. A estrutura atual utiliza `localStorage` por meio de uma camada central de armazenamento no `app.js`.

Cada navegador/dispositivo possui seu próprio conjunto de dados. Pessoas diferentes que acessarem o mesmo endereço não compartilham os registros. O identificador local (`installationId`) é gerado automaticamente na primeira utilização e **não é mecanismo de autenticação**.

Não há nesta versão:
- cadastro ou login;
- e-mail ou senha;
- banco de dados remoto;
- sincronização entre dispositivos;
- envio de check-ins para Vercel ou GitHub;
- analytics que coletem os registros pessoais.

### Atenção

Os dados podem ser perdidos se os dados do navegador forem apagados, se o navegador for redefinido ou se o dispositivo for substituído sem backup. Por isso, a área de configurações oferece:
- **Exportar meus dados** — salva um arquivo JSON local;
- **Importar meus dados** — restaura um backup em outro navegador/dispositivo;
- **Apagar meus dados** — exclui o conjunto local após confirmação.

O arquivo de backup contém os dados pessoais do Respiro. A pessoa deve guardá-lo com o mesmo cuidado que teria com os registros originais.

## Estrutura local

Os dados são mantidos em uma única estrutura versionada, com:
- `schemaVersion`;
- `installationId`;
- `createdAt`;
- `updatedAt`;
- `strategies`;
- `triggers`;
- `history`.

Toda leitura e gravação passa pela camada `Store` do `app.js`. A versão atual também migra dados de versões antigas do protótipo para a nova estrutura.

## Funcionalidades atuais

- check-in de emoção;
- intensidade de 1 a 10;
- gatilhos pré-cadastrados e personalizados;
- estratégias pré-cadastradas;
- adicionar/excluir estratégias;
- respiração guiada **4s inspirando + 6s soltando**, sem retenção;
- exercício guiado dos **5 sentidos**;
- histórico local;
- exportação/importação de backup;
- exclusão dos dados locais;
- funcionamento offline quando instalado como APK ou quando os arquivos web estiverem disponíveis localmente.

## Publicação no GitHub + Vercel

1. Coloque `index.html`, `styles.css`, `app.js` e `README.md` em um repositório GitHub.
2. No Vercel, importe o repositório.
3. Para esta versão estática, não é necessário banco, variável de ambiente ou autenticação.
4. Faça o deploy.

O Vercel hospeda os arquivos da aplicação; ele não recebe os registros salvos no `localStorage`.

## Testes antes da publicação

Testar no celular e no computador:

1. Criar check-in, gatilho e estratégia.
2. Fechar e reabrir o navegador.
3. Confirmar persistência dos dados.
4. Exportar um backup.
5. Apagar os dados.
6. Confirmar que o histórico, gatilhos e estratégias personalizados desapareceram.
7. Importar o backup e confirmar a restauração.
8. Abrir o mesmo endereço em outro navegador/dispositivo e confirmar que ele começa sem os dados do primeiro.
9. Confirmar que nenhuma chamada de rede é usada para enviar os registros pessoais.

## APK

O projeto Android incorpora a aplicação localmente. O APK pode ser gerado no Android Studio e instalado diretamente no telefone, sem Play Store.

> Este é um protótipo. Para uso real com dados de pacientes, ainda é necessário revisar privacidade, consentimento, segurança, LGPD e a adequação do armazenamento local ao contexto de uso.
