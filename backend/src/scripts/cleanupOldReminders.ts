import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupStats {
  totalReminders: number;
  sentReminders: number;
  expiredReminders: number;
  failedReminders: number;
  totalDeleted: number;
  recurringKept: number;
}

/**
 * Limpa lembretes antigos do banco de dados
 * @param dryRun - Se true, apenas mostra o que seria deletado sem executar
 * @param maxRetries - Número máximo de tentativas para considerar um lembrete como falho
 * @param daysOld - Número de dias para considerar um lembrete como antigo
 */
async function cleanupOldReminders(
  dryRun: boolean = false,
  maxRetries: number = 5,
  daysOld: number = 7
): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalReminders: 0,
    sentReminders: 0,
    expiredReminders: 0,
    failedReminders: 0,
    totalDeleted: 0,
    recurringKept: 0,
  };

  try {
    console.log('🔍 Analisando lembretes no banco de dados...\n');
    
    // Buscar todos os lembretes
    const allReminders = await prisma.reminder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    stats.totalReminders = allReminders.length;
    console.log(`📊 Total de lembretes encontrados: ${stats.totalReminders}`);

    // Data limite para considerar lembretes antigos
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Categorizar lembretes para limpeza
    const remindersToDelete: string[] = [];
    const now = new Date();

    for (const reminder of allReminders) {
      // Lembretes já enviados
      if (reminder.isSent) {
        stats.sentReminders++;
        remindersToDelete.push(reminder.id);
        continue;
      }

      // Lembretes que já passaram da data agendada (não recorrentes)
      if (reminder.scheduledAt < now && !reminder.isRecurring) {
        stats.expiredReminders++;
        remindersToDelete.push(reminder.id);
        continue;
      }

      // Lembretes com muitas tentativas falhas
      if (reminder.retryCount && reminder.retryCount >= maxRetries) {
        stats.failedReminders++;
        remindersToDelete.push(reminder.id);
        continue;
      }

      // Contar recorrentes que foram mantidos
      if (reminder.isRecurring) {
        stats.recurringKept++;
      }
    }

    stats.totalDeleted = remindersToDelete.length;

    // Mostrar estatísticas
    console.log('\n📈 Estatísticas de limpeza:');
    console.log(`├── 📤 Lembretes enviados: ${stats.sentReminders}`);
    console.log(`├── ⏰ Lembretes expirados: ${stats.expiredReminders}`);
    console.log(`├── ❌ Lembretes com falhas: ${stats.failedReminders}`);
    console.log(`├── 🔄 Lembretes recorrentes mantidos: ${stats.recurringKept}`);
    console.log(`└── 🗑️  Total a ser deletado: ${stats.totalDeleted}`);

    if (dryRun) {
      console.log('\n🔍 **MODO DRY RUN** - Nenhum lembrete foi deletado.');
      console.log('Execute sem --dry-run para efetuar a limpeza.');
    } else {
      if (stats.totalDeleted > 0) {
        console.log('\n🗑️  Iniciando limpeza...');
        
        // Deletar lembretes em lotes para melhor performance
        const batchSize = 100;
        let deletedCount = 0;

        for (let i = 0; i < remindersToDelete.length; i += batchSize) {
          const batch = remindersToDelete.slice(i, i + batchSize);
          
          const result = await prisma.reminder.deleteMany({
            where: {
              id: { in: batch }
            }
          });

          deletedCount += result.count;
          console.log(`├── Deletados ${deletedCount}/${stats.totalDeleted} lembretes`);
        }

        console.log(`\n✅ Limpeza concluída! ${deletedCount} lembretes foram removidos.`);
      } else {
        console.log('\n✨ Nenhum lembrete precisa ser removido.');
      }
    }

    return stats;

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    throw error;
  }
}

/**
 * Mostra lembretes específicos que serão deletados
 */
async function showRemindersToDelete(maxRetries: number = 5): Promise<void> {
  const now = new Date();
  
  console.log('📝 Lembretes que serão deletados:\n');

  // Lembretes enviados
  const sentReminders = await prisma.reminder.findMany({
    where: { isSent: true },
    take: 5,
    orderBy: { sentAt: 'desc' }
  });

  if (sentReminders.length > 0) {
    console.log('📤 Lembretes enviados (mostrando até 5):');
    sentReminders.forEach((reminder, index) => {
      const sentDate = reminder.sentAt ? new Date(reminder.sentAt).toLocaleString('pt-BR') : 'N/A';
      console.log(`${index + 1}. ${reminder.message.substring(0, 50)}... (enviado em ${sentDate})`);
    });
    console.log();
  }

  // Lembretes expirados
  const expiredReminders = await prisma.reminder.findMany({
    where: {
      scheduledAt: { lt: now },
      isSent: false,
      isRecurring: false
    },
    take: 5,
    orderBy: { scheduledAt: 'desc' }
  });

  if (expiredReminders.length > 0) {
    console.log('⏰ Lembretes expirados (mostrando até 5):');
    expiredReminders.forEach((reminder, index) => {
      const scheduledDate = new Date(reminder.scheduledAt).toLocaleString('pt-BR');
      console.log(`${index + 1}. ${reminder.message.substring(0, 50)}... (agendado para ${scheduledDate})`);
    });
    console.log();
  }

  // Lembretes com falhas
  const failedReminders = await prisma.reminder.findMany({
    where: {
      retryCount: { gte: maxRetries }
    },
    take: 5,
    orderBy: { retryCount: 'desc' }
  });

  if (failedReminders.length > 0) {
    console.log('❌ Lembretes com falhas (mostrando até 5):');
    failedReminders.forEach((reminder, index) => {
      console.log(`${index + 1}. ${reminder.message.substring(0, 50)}... (${reminder.retryCount} tentativas)`);
    });
    console.log();
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const showDetails = args.includes('--details');
  const maxRetries = parseInt(args.find(arg => arg.startsWith('--max-retries='))?.split('=')[1] || '5');
  const daysOld = parseInt(args.find(arg => arg.startsWith('--days-old='))?.split('=')[1] || '7');

  console.log('🧹 Script de Limpeza de Lembretes');
  console.log('================================\n');

  if (showDetails) {
    await showRemindersToDelete(maxRetries);
  }

  const stats = await cleanupOldReminders(dryRun, maxRetries, daysOld);

  if (dryRun) {
    console.log('\n💡 Dicas:');
    console.log('  • Use --details para ver exemplos dos lembretes que serão deletados');
    console.log('  • Use --max-retries=N para definir o limite de tentativas (padrão: 5)');
    console.log('  • Use --days-old=N para definir quantos dias considerar como antigo (padrão: 7)');
    console.log('  • Execute sem --dry-run para efetuar a limpeza');
  }

  console.log('\n📊 Resumo final:');
  console.log(`├── Total de lembretes: ${stats.totalReminders}`);
  console.log(`├── Lembretes ativos mantidos: ${stats.totalReminders - stats.totalDeleted}`);
  console.log(`└── Lembretes ${dryRun ? 'a serem deletados' : 'deletados'}: ${stats.totalDeleted}`);
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

export { cleanupOldReminders, showRemindersToDelete }; 