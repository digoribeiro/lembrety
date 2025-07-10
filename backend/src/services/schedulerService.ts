import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { sendWhatsAppMessage } from "./evolutionService";
import { Reminder } from "@prisma/client";

const prisma = new PrismaClient();
const JOB_INTERVAL = "* * * * *"; // Executa a cada minuto

// Função principal para verificar lembretes pendentes
export async function checkPendingReminders() {
  const serverNow = new Date(); // Horário atual do servidor (3h adiantado)

  // Ajustar para horário real de Brasília (subtrair 3 horas)
  const realNow = new Date(serverNow.getTime() - 3 * 60 * 60 * 1000);
  // Calcular 1 minuto atrás no horário real
  const oneMinuteAgo = new Date(realNow.getTime() - 1000);

  console.log(
    `[Scheduler] Horário do servidor: ${oneMinuteAgo.toISOString()}`,
    `| Horário real (Brasília): ${realNow.toISOString()}`
  );

  try {
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        scheduledAt: {
          gte: oneMinuteAgo,
          lte: realNow,
        },
        isSent: false,
        OR: [{ retryCount: { lt: 3 } }, { retryCount: null }],
      },
      take: 100,
    });

    console.log(
      `[Scheduler] Encontrados ${pendingReminders.length} lembretes para envio imediato`
    );

    for (const reminder of pendingReminders) {
      await processReminder(reminder);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[Scheduler] Erro ao processar lembretes:", errorMessage);
  }
}

// Processa um lembrete individual
export async function processReminder(reminder: Reminder) {
  try {
    console.log(
      `[Scheduler] Enviando lembrete ${reminder.id} para ${reminder.phone}`
    );

    await sendWhatsAppMessage({
      phone: reminder.phone,
      message: reminder.message,
    });

    // Atualiza como enviado com sucesso
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        isSent: true,
        sentAt: new Date(),
        retryCount: 0,
      },
    });

    console.log(`[Scheduler] Lembrete ${reminder.id} enviado com sucesso`);
  } catch (error) {
    // Tratamento seguro de erros unknown
    let errorMessage = "Erro desconhecido";
    let fullError = "";

    if (error instanceof Error) {
      errorMessage = error.message;
      fullError = error.stack || error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
      fullError = error;
    }

    console.error(
      `[Scheduler] Falha no lembrete ${reminder.id}:`,
      errorMessage
    );

    // Atualiza contagem de tentativas
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        retryCount: (reminder.retryCount || 0) + 1,
        lastError: errorMessage.substring(0, 255), // Armazena erro
      },
    });
  }
}

// Inicia o agendamento
export function startScheduler() {
  console.log("[Scheduler] Iniciando serviço de agendamento...");
  cron.schedule(JOB_INTERVAL, () => {
    checkPendingReminders().catch(console.error);
  });
}
