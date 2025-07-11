# 🔗 Sistema de Webhook para Lembretes WhatsApp

Este guia explica como configurar e usar o sistema de webhook que permite criar lembretes enviando mensagens com `#lembrete` no WhatsApp.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Configuração](#configuração)
3. [Como Usar](#como-usar)
4. [Formatos Suportados](#formatos-suportados)
5. [API Endpoints](#api-endpoints)
6. [Testes](#testes)
7. [Troubleshooting](#troubleshooting)

## 🔍 Visão Geral

O sistema permite que usuários criem lembretes automaticamente enviando mensagens de WhatsApp com o comando `#lembrete`. O sistema:

- ✅ Recebe mensagens via webhook do Evolution API
- ✅ Detecta comandos `#lembrete` e `#lembrar`
- ✅ Faz parse de data/hora em múltiplos formatos
- ✅ Cria lembretes no banco de dados
- ✅ Lista lembretes pendentes do usuário
- ✅ Responde ao usuário confirmando o agendamento
- ✅ Envia lembretes no horário agendado

## ⚙️ Configuração

### 1. Configurar o Webhook no Evolution API

**Opção A: Via API**
```bash
curl -X POST http://localhost:3000/api/webhook/configure \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://seu-servidor.com/api/webhook/evolution"
  }'
```

**Opção B: Manualmente no Evolution API**
1. Acesse o painel do Evolution API
2. Vá em Configurações > Webhook
3. Configure:
   - **URL**: `https://seu-servidor.com/api/webhook/evolution`
   - **Eventos**: `MESSAGE_RECEIVED`, `MESSAGE_UPSERT`, `MESSAGES_UPSERT`

### 2. Verificar Configuração

```bash
# Verificar status do webhook
curl http://localhost:3000/api/webhook/status

# Verificar configuração do Evolution API
curl http://localhost:3000/api/webhook/config
```

### 3. Variáveis de Ambiente

Certifique-se de que estas variáveis estão configuradas no `.env`:

```env
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key
WHATSAPP_INSTANCE=sua-instancia
DATABASE_URL=sua-database-url
TZ=America/Sao_Paulo
```

## 🚀 Como Usar

### Comandos Básicos

**Criar lembrete:**
```
#lembrete [quando] [hora] [mensagem]
```

**Listar lembretes pendentes:**
```
#lembrar
```

### Exemplos Práticos

**1. Hoje (horário específico):**
```
#lembrete 15:30 Reunião com cliente
#lembrete 09:00 Tomar remédio
```

**2. Data específica:**
```
#lembrete 25/12 20:00 Ceia de Natal
#lembrete 15/01/2024 14:30 Consulta médica
```

**3. Palavras-chave:**
```
#lembrete amanhã 07:00 Academia
#lembrete segunda 09:00 Reunião de equipe
#lembrete hoje 18:00 Comprar presente
```

**4. Listar lembretes:**
```
#lembrar
```
*Exemplo de resposta:*
```
📝 Seus Lembretes Pendentes

1. 📅 11/07/2025, 16:00
   💬 Reunião de equipe

2. 📅 12/07/2025, 09:00
   💬 Tomar remédio para pressão

💡 Dicas:
• Para criar: #lembrete [hora] [mensagem]
• Para ajuda: #lembrete
```

**5. Ajuda:**
```
#lembrete
```
(Apenas o comando, sem mais nada - retorna ajuda completa)

## 📝 Formatos Suportados

### Datas
- `hoje` - Hoje (se o horário já passou, agenda para amanhã)
- `amanhã` - Amanhã
- `segunda`, `terça`, `quarta`, `quinta`, `sexta`, `sábado`, `domingo` - Próximo dia da semana
- `DD/MM` - Data específica no ano atual
- `DD/MM/AAAA` - Data específica com ano

### Horários
- `HH:MM` - Formato 24 horas (ex: 14:30, 09:00)

### Padrões Regex Suportados
1. `HH:MM DD/MM[/YYYY] Mensagem`
2. `HH:MM Mensagem` (hoje)
3. `DD/MM[/YYYY] HH:MM Mensagem`
4. `palavra-chave HH:MM Mensagem`

## 🔌 API Endpoints

### Webhook Principal
```http
POST /api/webhook/evolution
```
Recebe mensagens do Evolution API e processa comandos `#lembrete`.

### Status e Configuração
```http
GET /api/webhook/status
```
Verifica se o webhook está ativo.

```http
GET /api/webhook/config
```
Mostra configuração atual do webhook no Evolution API.

```http
POST /api/webhook/configure
Content-Type: application/json

{
  "webhookUrl": "https://seu-servidor.com/api/webhook/evolution"
}
```
Configura o webhook no Evolution API.

### Teste Manual
```http
POST /api/webhook/test
Content-Type: application/json

{
  "phone": "5511999999999",
  "message": "#lembrete 15:30 Teste de lembrete"
}
```
Testa o sistema de parsing sem usar o WhatsApp.

## 🧪 Testes

### Teste Rápido
1. Envie uma mensagem: `#lembrete 15:30 Teste de lembrete`
2. Deve receber confirmação imediata
3. Aguarde o horário agendado para receber o lembrete

### Teste via API
```bash
curl -X POST http://localhost:3000/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "#lembrete amanhã 09:00 Reunião importante"
  }'
```

### Logs para Debug
O sistema gera logs detalhados:
```bash
[Webhook] Recebido: {...}
[Webhook] Processando mensagem de 5511999999999: "#lembrete 15:30 Teste"
[Webhook] Enviando resposta para 5511999999999: ✅ Lembrete criado...
```

## 🔧 Troubleshooting

### Problemas Comuns

**1. Webhook não recebe mensagens**
- Verifique se o webhook está configurado no Evolution API
- Teste a conectividade: `curl https://seu-servidor.com/api/webhook/status`
- Verifique se a instância do WhatsApp está conectada

**2. Mensagens não são processadas**
- Verifique os logs do servidor
- Teste com o endpoint `/api/webhook/test`
- Confirme que a mensagem contém exatamente `#lembrete`

**3. Formato de data inválido**
- Use o formato correto: `#lembrete HH:MM Mensagem`
- Envie apenas `#lembrete` para ver os formatos suportados
- Verifique se está usando horário 24h (14:30, não 2:30 PM)

**4. Lembretes não são enviados**
- Verifique se o scheduler está rodando
- Confirme as configurações de fuso horário (`TZ=America/Sao_Paulo`)
- Verifique se o Evolution API está conectado

### Logs Úteis para Debug

```bash
# Ver logs do webhook
grep "\[Webhook\]" logs/app.log

# Ver logs do scheduler
grep "\[Scheduler\]" logs/app.log

# Ver erros de parsing
grep "Erro ao fazer parse" logs/app.log
```

### Testar Componentes Isoladamente

**1. Testar Parser de Mensagem:**
```javascript
import { parseReminderMessage } from './services/messageParserService';

const result = parseReminderMessage("#lembrete 15:30 Teste", "5511999999999");
console.log(result);
```

**2. Testar Webhook Controller:**
```bash
curl -X POST http://localhost:3000/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511999999999", "message": "#lembrete 15:30 Teste"}'
```

**3. Testar Evolution API:**
```bash
curl -X POST http://localhost:3000/api/test-message \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511999999999", "message": "Teste de envio"}'
```

## 📊 Monitoramento

### Métricas Importantes
- Mensagens recebidas via webhook
- Lembretes criados com sucesso
- Erros de parsing
- Lembretes enviados pelo scheduler

### Health Check
```bash
# Status geral do sistema
curl http://localhost:3000/api/webhook/status

# Status da instância WhatsApp
curl http://localhost:3000/api/webhook/config
```

## 🔐 Segurança

### Recomendações
- Use HTTPS para o webhook URL
- Configure firewall para permitir apenas IPs do Evolution API
- Implemente rate limiting se necessário
- Monitore logs para detectar uso anômalo

## 🎯 Próximos Passos

### Melhorias Futuras
- [ ] Suporte a lembretes recorrentes
- [ ] Integração com calendários (Google Calendar, Outlook)
- [ ] Lembretes com localização
- [ ] Interface web para gerenciar lembretes
- [ ] Notificações por email além do WhatsApp
- [ ] Analytics de uso dos lembretes

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs primeiro
2. Teste os endpoints isoladamente
3. Confirme a configuração do Evolution API
4. Verifique as variáveis de ambiente

**Sistema desenvolvido com ❤️ para automatizar seus lembretes via WhatsApp!** 