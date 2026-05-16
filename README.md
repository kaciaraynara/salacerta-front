# SalaCerta - Front-end Web (Next.js)

Interface do usuário desenvolvida em React com Next.js e TypeScript para disponibilizar o painel de monitoramento de ocupação e o formulário de agendamento de salas de reunião.

A aplicação interage de forma transparente com os dois microsserviços do ecossistema (Autenticação em C# e Reservas em Python).

## Decisões Técnicas e Arquitetura

* **Next.js (App Router) & TypeScript:** Utilizado para garantir componentização limpa, rotas organizadas e segurança em tempo de desenvolvimento por meio da imposição de tipagem estática nos contratos de dados consumidos das APIs.
* **Axios Interceptors:** A comunicação HTTP foi centralizada em uma instância customizada do Axios configurada com um interceptor. Ele captura o token salvo no navegador e injeta automaticamente o cabeçalho `Authorization: Bearer <token>` em todas as chamadas feitas para o backend Python, evitando duplicação de lógica nos componentes de tela.
* **Dropdowns Dependentes em Memória:** Para evitar requisições desnecessárias de rede a cada clique, a relação entre locais e salas é controlada no lado do cliente por meio de hooks nativos (`useEffect` e `useCallback`). Assim que o usuário muda a filial selecionada no formulário, o catálogo de salas disponíveis é filtrado imediatamente na interface.

## Como Configurar e Rodar Localmente

### Pré-requisitos
* Node.js (versão 18 ou superior) instalado

### Passo a Passo

1. Abra o terminal na pasta raiz deste projeto e instale as dependências declaradas no manifesto:

npm install

Certifique-se de que as rotas base configuradas no arquivo de serviços apontam corretamente para os endereços locais de execução das APIs:

Back-end C# (Autenticação): http://localhost:5000

Back-end Python (Reservas): http://localhost:8000

Inicialize o servidor em modo de desenvolvimento local:

npm run dev
A aplicação estará disponível e rodando no navegador através do endereço http://localhost:3000.