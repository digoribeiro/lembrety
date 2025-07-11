# 🧹 Limpeza de Lembretes Antigos

Este sistema inclui um script para limpeza automática de lembretes antigos que não são mais necessários no banco de dados.

## 🎯 O que é removido

O script remove automaticamente:

✅ **Lembretes já enviados** (`isSent = true`)
✅ **Lembretes expirados** (data já passou e não são recorrentes)
✅ **Lembretes com falhas** (muitas tentativas de envio)

## 🛡️ O que é preservado

❌ **Lembretes recorrentes** (mantidos para gerar próximas ocorrências)
❌ **Lembretes futuros** (ainda não chegou a hora)
❌ **Lembretes com poucas tentativas** (ainda podem ser enviados)

## 🚀 Como usar

### 1. Verificar o que será deletado (recomendado)

```bash
npm run cleanup:dry-run
```

### 2. Ver exemplos detalhados dos lembretes

```bash
npm run cleanup:details
```

### 3. Executar a limpeza

```bash
npm run cleanup:execute
```

### 4. Limpeza mais conservadora (30 dias + 10 tentativas)

```bash
npm run cleanup:safe
```

## ⚙️ Opções avançadas

### Execução manual com parâmetros

```bash
# Dry run (apenas visualizar)
ts-node src/scripts/cleanupOldReminders.ts --dry-run

# Com detalhes
ts-node src/scripts/cleanupOldReminders.ts --dry-run --details

# Personalizar limite de tentativas
ts-node src/scripts/cleanupOldReminders.ts --max-retries=3

# Personalizar dias para considerar antigo
ts-node src/scripts/cleanupOldReminders.ts --days-old=14

# Executar limpeza real
ts-node src/scripts/cleanupOldReminders.ts
```

### Parâmetros disponíveis

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `--dry-run` | false | Apenas mostra o que seria deletado |
| `--details` | false | Mostra exemplos dos lembretes |
| `--max-retries=N` | 5 | Limite de tentativas para considerar falha |
| `--days-old=N` | 7 | Dias para considerar lembrete antigo |

## 📊 Exemplo de saída

```
🧹 Script de Limpeza de Lembretes
================================

🔍 Analisando lembretes no banco de dados...

📊 Total de lembretes encontrados: 1247

📈 Estatísticas de limpeza:
├── 📤 Lembretes enviados: 892
├── ⏰ Lembretes expirados: 45
├── ❌ Lembretes com falhas: 12
├── 🔄 Lembretes recorrentes mantidos: 23
└── 🗑️  Total a ser deletado: 949

🗑️  Iniciando limpeza...
├── Deletados 100/949 lembretes
├── Deletados 200/949 lembretes
...
├── Deletados 949/949 lembretes

✅ Limpeza concluída! 949 lembretes foram removidos.

📊 Resumo final:
├── Total de lembretes: 1247
├── Lembretes ativos mantidos: 298
└── Lembretes deletados: 949
```

## 🔄 Automação

### Executar diariamente via cron

```bash
# Adicionar ao crontab
0 2 * * * cd /caminho/para/projeto && npm run cleanup:safe
```

### Executar semanalmente (mais seguro)

```bash
# Toda segunda-feira às 3h
0 3 * * 1 cd /caminho/para/projeto && npm run cleanup:execute
```

## ⚠️ Importante

1. **Sempre teste primeiro** com `--dry-run`
2. **Faça backup** do banco antes de executar
3. **Lembretes recorrentes** nunca são deletados
4. **Operação irreversível** - lembretes deletados não podem ser recuperados

## 🔧 Integração com código

```typescript
import { cleanupOldReminders } from './src/scripts/cleanupOldReminders';

// Executar limpeza programaticamente
const stats = await cleanupOldReminders(false, 5, 7);
console.log(`Deletados: ${stats.totalDeleted} lembretes`);
``` 