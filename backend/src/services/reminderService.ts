import { PrismaClient, RecurrenceType } from "@prisma/client";

import { sendWhatsAppMessage, verifyInstanceStatus } from "./evolutionService";

// Importe o novo serviço

const prisma = new PrismaClient();

export const scheduleReminderService = async (
  message: string,
  phone: string,
  scheduledAt: Date
) => {
  const prefixedMessage = message.startsWith("🔔 *Lembrete:*")
    ? message
    : `🔔 *Lembrete:* ${message}`;

  const reminder = await prisma.reminder.create({
    data: {
      message: prefixedMessage,
      phone: formatPhoneNumber(phone),
      scheduledAt,
    },
  });

  return reminder;
};

// Função para formatar números de telefone
const formatPhoneNumber = (phone: string): string => {
  // Remove todos os não-dígitos
  let formatted = phone.replace(/\D/g, "");

  // Adiciona código do país se necessário
  if (!formatted.startsWith("55") && formatted.length === 11) {
    formatted = "55" + formatted;
  }

  // Verifica se o número tem comprimento válido
  if (formatted.length < 12 || formatted.length > 14) {
    throw new Error(
      "Número de telefone inválido! Use o formato: 5511999999999"
    );
  }

  return formatted;
};

// Função para criar lembrete com suporte a recorrência
export const createReminder = async (reminderData: {
  message: string;
  phone: string;
  scheduledAt: Date;
  isRecurring?: boolean;
  recurrenceType?: RecurrenceType;
  recurrencePattern?: string;
  seriesId?: string;
  parentId?: string;
  endDate?: Date;
}) => {
  const prefixedMessage = reminderData.message.startsWith("🔔 *Lembrete:*")
    ? reminderData.message
    : `🔔 *Lembrete:* ${reminderData.message}`;

  const reminder = await prisma.reminder.create({
    data: {
      message: prefixedMessage,
      phone: formatPhoneNumber(reminderData.phone),
      scheduledAt: reminderData.scheduledAt,
      isRecurring: reminderData.isRecurring || false,
      recurrenceType: reminderData.recurrenceType,
      recurrencePattern: reminderData.recurrencePattern,
      seriesId: reminderData.seriesId,
      parentId: reminderData.parentId,
      endDate: reminderData.endDate,
    },
  });

  return reminder;
};

// Função para buscar lembretes pendentes de um usuário
export const getPendingRemindersByPhone = async (phone: string) => {
  const formattedPhone = formatPhoneNumber(phone);
  
  const pendingReminders = await prisma.reminder.findMany({
    where: {
      phone: formattedPhone,
      isSent: false,
      OR: [{ retryCount: { lt: 3 } }, { retryCount: null }],
    },
    orderBy: {
      scheduledAt: 'asc',
    },
    take: 20, // Limita a 20 lembretes para não sobrecarregar o WhatsApp
  });

  return pendingReminders;
};

// Função para cancelar um lembrete por ID
export const cancelReminderById = async (reminderId: string) => {
  return await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      isSent: true,
      sentAt: new Date(),
      lastError: "Cancelado pelo usuário",
      retryCount: 0,
    },
  });
};

// Função para editar a mensagem de um lembrete por ID
export const editReminderById = async (reminderId: string, newMessage: string) => {
  // Adiciona o prefixo se não existir
  const prefixedMessage = newMessage.startsWith("🔔 *Lembrete:*")
    ? newMessage
    : `🔔 *Lembrete:* ${newMessage}`;

  return await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      message: prefixedMessage,
    },
  });
};

// Função para reagendar (alterar data/hora) de um lembrete por ID
export const rescheduleReminderById = async (reminderId: string, newScheduledAt: Date) => {
  return await prisma.reminder.update({
    where: {
      id: reminderId,
    },
    data: {
      scheduledAt: newScheduledAt,
    },
  });
};

// Função para testar conexão com a Evolution API
export const testEvolutionConnection = async () => {
  try {
    const status = await verifyInstanceStatus();
    return {
      connected: status.state === "open",
      instance: status.instance,
    };
  } catch (error) {
    return {
      connected: false,
      error: "Erro ao conectar com Evolution API",
    };
  }
};
