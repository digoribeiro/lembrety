import { PrismaClient } from "@prisma/client";

import { sendWhatsAppMessage, verifyInstanceStatus } from "./evolutionService";

// Importe o novo serviço

const prisma = new PrismaClient();

export const scheduleReminderService = async (
  message: string,
  phone: string,
  scheduledAt: Date
) => {
  // Verificar formato do número (deve ser internacional: 5511999999999)
  const formattedPhone = formatPhoneNumber(phone);

  const reminder = await prisma.reminder.create({
    data: {
      message,
      phone: formattedPhone,
      scheduledAt,
    },
  });

  return reminder;
};

// Função para formatar números de telefone
const formatPhoneNumber = (phone: string): string => {
  // Remove todos os não-dígitos
  let formatted = phone.replace(/\D/g, '');
  
  // Adiciona código do país se necessário
  if (!formatted.startsWith('55') && formatted.length === 11) {
    formatted = '55' + formatted;
  }
  
  // Verifica se o número tem comprimento válido
  if (formatted.length < 12 || formatted.length > 14) {
    throw new Error('Número de telefone inválido! Use o formato: 5511999999999');
  }
  
  return formatted;
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
