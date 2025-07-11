import { PrismaClient, Reminder } from "@prisma/client";
import { createReminder } from "./reminderService";

const prisma = new PrismaClient();

/**
 * Calcula a próxima data/hora de ocorrência baseada no tipo de recorrência
 */
export function calculateNextOccurrence(
  currentDate: Date,
  recurrenceType: string,
  recurrencePattern: string
): Date | null {
  const nextDate = new Date(currentDate);

  switch (recurrenceType) {
    case 'DAILY':
      // Adiciona 1 dia
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;

    case 'WEEKLY':
      if (recurrencePattern === '1') {
        // Toda semana (7 dias)
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        // Dia específico da semana
        const targetDay = parseInt(recurrencePattern);
        const currentDay = nextDate.getDay();
        let daysToAdd = targetDay - currentDay;
        
        if (daysToAdd <= 0) {
          daysToAdd += 7; // Próxima semana
        }
        
        nextDate.setDate(nextDate.getDate() + daysToAdd);
      }
      return nextDate;

    case 'SPECIFIC_DAYS':
      // Dias específicos da semana (ex: "1,3,5" = segunda, quarta, sexta)
      const days = recurrencePattern.split(',').map(d => parseInt(d)).sort();
      const currentDay = nextDate.getDay();
      
      // Encontra o próximo dia válido
      let nextTargetDay = days.find(day => day > currentDay);
      
      if (nextTargetDay !== undefined) {
        // Há um dia válido ainda nesta semana
        const daysToAdd = nextTargetDay - currentDay;
        nextDate.setDate(nextDate.getDate() + daysToAdd);
      } else {
        // Vai para o primeiro dia da próxima semana
        const firstDay = days[0];
        const daysToAdd = 7 - currentDay + firstDay;
        nextDate.setDate(nextDate.getDate() + daysToAdd);
      }
      return nextDate;

    case 'MONTHLY':
      // Adiciona 1 mês mantendo o mesmo dia e hora
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      // Verifica se o dia ainda é válido no novo mês
      // (ex: 31 de janeiro -> 28/29 de fevereiro)
      if (nextDate.getDate() !== currentDate.getDate()) {
        // Se o dia mudou, vai para o último dia do mês
        nextDate.setDate(0); // Vai para o último dia do mês anterior
      }
      return nextDate;

    default:
      return null;
  }
}

/**
 * Cria a próxima ocorrência de um lembrete recorrente
 */
export async function createNextOccurrence(reminder: Reminder): Promise<Reminder | null> {
  if (!reminder.isRecurring || !reminder.recurrenceType || !reminder.recurrencePattern) {
    return null;
  }

  // Calcula a próxima data
  const nextDate = calculateNextOccurrence(
    reminder.scheduledAt,
    reminder.recurrenceType as string,
    reminder.recurrencePattern
  );

  if (!nextDate) {
    return null;
  }

  // Verifica se há data final e se já passou
  if (reminder.endDate && nextDate > reminder.endDate) {
    console.log(`[Recurrence] Série ${reminder.seriesId} chegou ao fim`);
    return null;
  }

  // Cria o próximo lembrete da série
  const nextReminder = await createReminder({
    message: reminder.message,
    phone: reminder.phone,
    scheduledAt: nextDate,
    isRecurring: true,
    recurrenceType: reminder.recurrenceType,
    recurrencePattern: reminder.recurrencePattern || undefined,
    seriesId: reminder.seriesId || undefined,
    parentId: reminder.parentId || reminder.id, // Se não tem parent, este é o parent
    endDate: reminder.endDate || undefined,
  });

  console.log(`[Recurrence] Próxima ocorrência criada: ${nextReminder.id} para ${nextDate.toISOString()}`);
  return nextReminder;
}

/**
 * Processa lembretes enviados e cria próximas ocorrências se necessário
 */
export async function processRecurringReminders(): Promise<void> {
  try {
    // Busca lembretes recorrentes que foram enviados recentemente (últimas 24h)
    const since24HoursAgo = new Date();
    since24HoursAgo.setDate(since24HoursAgo.getDate() - 1);

    const sentRecurringReminders = await prisma.reminder.findMany({
      where: {
        isRecurring: true,
        isSent: true,
        sentAt: {
          gte: since24HoursAgo,
        },
        recurrenceType: {
          not: null,
        },
      },
    });

    console.log(`[Recurrence] Processando ${sentRecurringReminders.length} lembretes recorrentes enviados`);

    for (const reminder of sentRecurringReminders) {
      // Verifica se já existe uma próxima ocorrência criada
      const nextDate = calculateNextOccurrence(
        reminder.scheduledAt,
        reminder.recurrenceType! as string,
        reminder.recurrencePattern!
      );

      if (!nextDate) continue;

      // Verifica se já existe um lembrete para a próxima data
      const existingNext = await prisma.reminder.findFirst({
        where: {
          seriesId: reminder.seriesId,
          scheduledAt: {
            gte: nextDate,
            lt: new Date(nextDate.getTime() + 60 * 60 * 1000), // +1 hora de tolerância
          },
        },
      });

      if (!existingNext) {
        await createNextOccurrence(reminder);
      }
    }
  } catch (error) {
    console.error('[Recurrence] Erro ao processar lembretes recorrentes:', error);
  }
}

/**
 * Cancela toda uma série de lembretes recorrentes
 */
export async function cancelRecurringSeries(seriesId: string): Promise<number> {
  try {
    const result = await prisma.reminder.updateMany({
      where: {
        seriesId: seriesId,
        isSent: false, // Só cancela os que ainda não foram enviados
      },
      data: {
        isSent: true,
        sentAt: new Date(),
        lastError: "Série cancelada pelo usuário",
      },
    });

    console.log(`[Recurrence] Cancelados ${result.count} lembretes da série ${seriesId}`);
    return result.count;
  } catch (error) {
    console.error('[Recurrence] Erro ao cancelar série:', error);
    return 0;
  }
}

/**
 * Lista séries de lembretes recorrentes ativas
 */
export async function getActiveRecurringSeries(phone: string) {
  try {
    const series = await prisma.reminder.findMany({
      where: {
        phone: phone,
        isRecurring: true,
        isSent: false,
        parentId: null, // Só os lembretes "pai" da série
      },
      include: {
        children: {
          where: {
            isSent: false,
          },
          orderBy: {
            scheduledAt: 'asc',
          },
          take: 3, // Próximas 3 ocorrências
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return series;
  } catch (error) {
    console.error('[Recurrence] Erro ao buscar séries ativas:', error);
    return [];
  }
} 