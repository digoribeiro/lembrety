# Lembrety Backend

Sistema de lembretes automatizados via WhatsApp - API Backend

## 📋 Sobre o Projeto

O Lembrety Backend é uma API REST desenvolvida em Node.js que permite agendar e enviar lembretes automáticos via WhatsApp. O sistema utiliza a Evolution API para integração com WhatsApp e oferece endpoints para criar lembretes e testar envios de mensagens.

## 🚀 Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **TypeScript** - Linguagem de programação
- **Express.js** - Framework web
- **Prisma** - ORM para banco de dados
- **PostgreSQL** - Banco de dados
- **Evolution API** - Integração com WhatsApp
- **Axios** - Cliente HTTP
- **Dotenv** - Gerenciamento de variáveis de ambiente

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── controllers/
│   │   └── reminderController.ts    # Controlador de lembretes
│   ├── services/
│   │   ├── reminderService.ts       # Lógica de negócio dos lembretes
│   │   ├── evolutionService.ts      # Integração com Evolution API
│   │   └── schedulerService.ts      # Serviço de agendamento (vazio)
│   ├── scripts/
│   │   └── checkInstance.ts         # Script para verificar instância WhatsApp
│   ├── routes.ts                    # Definição das rotas
│   └── server.ts                    # Servidor principal
├── prisma/
│   ├── schema.prisma                # Schema do banco de dados
│   └── migrations/                  # Migrações do banco
├── package.json
├── tsconfig.json
└── .env                            # Variáveis de ambiente (criar)
```

## 🛠️ Instalação e Configuração

### Pré-requisitos

- Node.js (versão 18 ou superior)
- PostgreSQL
- Conta na Evolution API
- Instância WhatsApp conectada na Evolution API

### 1. Clone e instale dependências

```bash
cd backend
npm install
```

### 2. Configuração do Banco de Dados

Crie um banco PostgreSQL e configure a URL de conexão no arquivo `.env`.

### 3. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do backend com as seguintes variáveis:

### 4. Execute as migrações

```bash
npm run prisma:migrate
```

### 5. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 📊 Modelo de Dados

### Tabela: Reminder

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String (UUID) | Identificador único |
| message | String | Mensagem do lembrete |
| scheduledAt | DateTime | Data e hora agendada |
| phone | String | Número de telefone (formato internacional) |
| isSent | Boolean | Status de envio (padrão: false) |
| createdAt | DateTime | Data de criação |

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000/api
```

### 1. Criar Lembrete

**POST** `/reminder`

Agenda um novo lembrete para envio via WhatsApp.

**Body:**
```json
{
  "message": "Lembrete: Reunião às 14h",
  "phone": "11999999999",
  "scheduledAt": "2024-12-31T14:00:00.000Z"
}
```

**Resposta de Sucesso (201):**
```json
{
  "id": "uuid-do-lembrete",
  "message": "Lembrete: Reunião às 14h",
  "phone": "5511999999999",
  "scheduledAt": "2024-12-31T14:00:00.000Z",
  "isSent": false,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Resposta de Erro (400):**
```json
{
  "error": "Mensagem inválida"
}
```

### 2. Testar Envio de Mensagem

**POST** `/test-message`

Envia uma mensagem diretamente via WhatsApp (para testes).

**Body:**
```json
{
  "phone": "11999999999",
  "message": "Mensagem de teste"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "messageId": "id-da-mensagem"
}
```

**Resposta de Erro (500):**
```json
{
  "success": false,
  "error": "Falha ao enviar mensagem"
}
```

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento com hot reload
npm run dev

# Build para produção
npm run build

# Executar versão de produção
npm start

# Executar migrações do banco
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio
```