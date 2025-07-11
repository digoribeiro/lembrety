import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { sendWhatsAppMessage } from "./evolutionService";
import { Reminder } from "@prisma/client";

const prisma = new PrismaClient();
const JOB_INTERVAL = "* * * * *"; // Executa a cada minuto

// Função principal para verificar lembretes pendentes
export async function checkPendingReminders() {
  const nowBrazil = new Date();
  
  // Como salvamos horário literal como UTC, comparamos com horário Brasil atual em UTC
  const nowUTC = new Date(Date.UTC(
    nowBrazil.getFullYear(), 
    nowBrazil.getMonth(), 
    nowBrazil.getDate(),
    nowBrazil.getHours(), 
    nowBrazil.getMinutes()
  ));
  
  console.log(
    `[Scheduler] Brasil Local: ${nowBrazil.toISOString()} | UTC Literal: ${nowUTC.toISOString()}`
  );

  try {
    // Busca todos os lembretes que já deveriam ter sido enviados
    // Como salvamos horário literal em UTC, comparamos com horário atual também em UTC
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        scheduledAt: {
          lte: nowUTC, // Busca lembretes com scheduledAt <= agora (UTC literal)
        },
        isSent: false,
        OR: [{ retryCount: { lt: 3 } }, { retryCount: null }],
      },
      take: 100,
    });

    console.log(
      `[Scheduler] Encontrados ${pendingReminders.length} lembretes para envio`
    );

    // Debug: mostrar lembretes encontrados
    for (const reminder of pendingReminders) {
      // Como salvamos horário literal, o horário no banco representa exatamente o que o usuário digitou
      const scheduledBrasil = reminder.scheduledAt.toLocaleString('pt-BR');
      console.log(
        `[Scheduler] → Lembrete ${reminder.id}: agendado para ${reminder.scheduledAt.toISOString()} (${scheduledBrasil} literal)`
      );
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
