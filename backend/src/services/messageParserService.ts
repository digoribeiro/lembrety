import { createReminder, getPendingRemindersByPhone, cancelReminderById, editReminderById } from "./reminderService";
import { Reminder } from "@prisma/client";

interface ParsedReminder {
  phone: string;
  message: string;
  scheduledAt: Date;
}

interface WebhookMessage {
  from: string;
  text?: {
    body: string;
  };
  timestamp: string;
  type: string;
}

/**
 * Detecta se uma mensagem contém o comando #lembrete
 */
export function isReminderMessage(messageBody: string): boolean {
  return messageBody.toLowerCase().includes("#lembrete");
}

// Detecta se uma mensagem contém o comando #lembrar (para listar lembretes)
export function isListRemindersMessage(messageBody: string): boolean {
  return messageBody.toLowerCase().trim() === "#lembrar";
}

/**
 * Detecta se uma mensagem contém o comando #cancelar [número] (com ou sem confirmação)
 */
export function isCancelReminderMessage(messageBody: string): boolean {
  return /^#cancelar\s+\d+(\s+confirmar)?$/i.test(messageBody.trim());
}

/**
 * Detecta se uma mensagem contém o comando #editar [número] [nova mensagem]
 */
export function isEditReminderMessage(messageBody: string): boolean {
  return /^#editar\s+\d+\s+.+$/i.test(messageBody.trim());
}

/**
 * Extrai o número do lembrete e se há confirmação do comando #cancelar
 */
export function parseCancelReminderCommand(messageBody: string): { number: number | null; confirmed: boolean } {
  const match = messageBody.trim().match(/^#cancelar\s+(\d+)(\s+confirmar)?$/i);
  
  if (match) {
    const number = parseInt(match[1]);
    const confirmed = !!match[2]; // true se contém "confirmar"
    
    return {
      number: number > 0 ? number : null, // Apenas números positivos
      confirmed
    };
  }
  
  return { number: null, confirmed: false };
}

/**
 * Extrai o número do lembrete e a nova mensagem do comando #editar
 */
export function parseEditReminderCommand(messageBody: string): { number: number | null; newMessage: string | null } {
  const match = messageBody.trim().match(/^#editar\s+(\d+)\s+(.+)$/i);
  
  if (match) {
    const number = parseInt(match[1]);
    const newMessage = match[2].trim();
    
    // Se number é inválido (0 ou negativo), retorna null para ambos
    if (number <= 0) {
      return { number: null, newMessage: null };
    }
    
    return {
      number: number,
      newMessage: newMessage.length > 0 ? newMessage : null
    };
  }
  
  return { number: null, newMessage: null };
}

/**
 * Parse da mensagem #lembrete para extrair informações do lembrete
 *
 * Formatos suportados:
 * - #lembrete 15:30 Reunião com cliente
 * - #lembrete 15:30 25/12 Reunião com cliente
 * - #lembrete amanhã 15:30 Reunião com cliente
 * - #lembrete hoje 15:30 Reunião com cliente
 * - #lembrete segunda 15:30 Reunião com cliente
 * - #lembrete 25/12/2024 15:30 Reunião com cliente
 */
export function parseReminderMessage(
  messageBody: string,
  senderPhone: string
): ParsedReminder | null {
  try {
    // Remove o #lembrete do início
    const content = messageBody.replace(/#lembrete\s*/i, "").trim();

    if (!content) {
      throw new Error("Conteúdo do lembrete não pode estar vazio");
    }

    // Regex para capturar diferentes formatos de data/hora
    const patterns = [
      // Formato: HH:MM DD/MM[/YYYY] Mensagem
      /^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(.+)$/,
      // Formato: HH:MM Mensagem (hoje)
      /^(\d{1,2}):(\d{2})\s+(.+)$/,
      // Formato: DD/MM[/YYYY] HH:MM Mensagem
      /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})\s+(.+)$/,
      // Formato: amanhã/hoje/segunda HH:MM Mensagem
      /^(amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)\s+(\d{1,2}):(\d{2})\s+(.+)$/i,
    ];

    let scheduledAt: Date | null = null;
    let reminderText = "";

    for (const pattern of patterns) {
      const match = content.match(pattern);

      if (match) {
        scheduledAt = parseDateTime(match);
        reminderText = extractMessage(match);
        break;
      }
    }

    if (!scheduledAt || !reminderText) {
      throw new Error(
        "Formato de lembrete inválido. Use: #lembrete HH:MM Mensagem ou #lembrete DD/MM HH:MM Mensagem"
      );
    }

    return {
      phone: senderPhone,
      message: reminderText.trim(),
      scheduledAt,
    };
  } catch (error) {
    console.error("Erro ao fazer parse da mensagem de lembrete:", error);
    return null;
  }
}

/**
 * Cria data salvando horário literal como UTC (simula UTC-3)
 */
function createLiteralDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  // Para salvar "07:00" como "07:00:00.000Z" no banco
  return new Date(Date.UTC(year, month, day, hour, minute));
}

/**
 * Extrai data e hora do match da regex - NOVA VERSÃO UTC-3
 */
function parseDateTime(match: RegExpMatchArray): Date | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  try {
    // Formato: HH:MM DD/MM[/YYYY] Mensagem
    if (match[6] && match[1] && match[2] && match[3] && match[4]) {
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const day = parseInt(match[3]);
      const month = parseInt(match[4]) - 1; // JS months are 0-indexed
      const year = match[5] ? parseInt(match[5]) : currentYear;

      const date = createLiteralDate(year, month, day, hour, minute);
      return validateDate(date);
    }

    // Formato: HH:MM Mensagem (hoje)
    if (match[3] && match[1] && match[2] && !match[4]) {
      const hour = parseInt(match[1]);
      const minute = parseInt(match[2]);

      const date = createLiteralDate(
        currentYear,
        currentMonth,
        currentDate,
        hour,
        minute
      );

      // Se o horário já passou hoje, agenda para amanhã
      // Comparação usando o mesmo sistema de horário (UTC literal)
      const nowLiteralUTC = new Date(
        Date.UTC(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours(),
          now.getMinutes()
        )
      );
      if (date <= nowLiteralUTC) {
        date.setDate(date.getDate() + 1);
        // Marca que foi agendado para amanhã por ter passado o horário
        (date as any)._wasRescheduled = true;
      }

      // Não chama validateDate para evitar dupla validação
      return date;
    }

    // Formato: DD/MM[/YYYY] HH:MM Mensagem
    if (match[6] && match[4] && match[5] && match[1] && match[2]) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = match[3] ? parseInt(match[3]) : currentYear;
      const hour = parseInt(match[4]);
      const minute = parseInt(match[5]);

      const date = createLiteralDate(year, month, day, hour, minute);
      return validateDate(date);
    }

    // Formato: amanhã/hoje/dia-da-semana HH:MM Mensagem
    if (match[4] && match[1] && match[2] && match[3]) {
      const dayWord = match[1].toLowerCase();
      const hour = parseInt(match[2]);
      const minute = parseInt(match[3]);

      const date = createLiteralDate(
        currentYear,
        currentMonth,
        currentDate,
        hour,
        minute
      );

      if (dayWord === "hoje") {
        const nowLiteralUTC = new Date(
          Date.UTC(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            now.getMinutes()
          )
        );
        if (date <= nowLiteralUTC) {
          date.setDate(date.getDate() + 1); // Se já passou, agenda para amanhã
        }
      } else if (dayWord === "amanhã") {
        date.setDate(date.getDate() + 1);
      } else {
        // Dias da semana
        const dayMap: { [key: string]: number } = {
          domingo: 0,
          segunda: 1,
          terça: 2,
          quarta: 3,
          quinta: 4,
          sexta: 5,
          sábado: 6,
        };

        const targetDay = dayMap[dayWord];
        if (targetDay !== undefined) {
          const currentDay = now.getDay();
          let daysToAdd = targetDay - currentDay;

          if (daysToAdd <= 0) {
            daysToAdd += 7; // Próxima semana
          }

          date.setDate(date.getDate() + daysToAdd);
        }
      }

      // Não chama validateDate para evitar dupla validação - dias da semana sempre são futuros
      return date;
    }

    return null;
  } catch (error) {
    console.error("Erro ao fazer parse da data/hora:", error);
    return null;
  }
}

/**
 * Extrai a mensagem do lembrete do match da regex
 */
function extractMessage(match: RegExpMatchArray): string {
  // Pega o último grupo capturado que deve ser a mensagem
  for (let i = match.length - 1; i >= 0; i--) {
    if (match[i] && !match[i].match(/^\d/) && match[i].length > 3) {
      return match[i];
    }
  }
  return "";
}

/**
 * Valida apenas se a data é válida (não verifica se é passada)
 */
function validateDate(date: Date): Date | null {
  if (isNaN(date.getTime())) {
    return null;
  }

  // Retorna a data sem modificações - a lógica de tempo já foi tratada anteriormente
  return date;
}

/**
 * Processa mensagem do webhook e cria lembrete se for válida
 */
export async function processWebhookMessage(message: WebhookMessage): Promise<{
  success: boolean;
  response: string;
  reminder?: any;
}> {
  try {
    const messageBody = message.text?.body;
    const senderPhone = message.from;

    if (!messageBody) {
      return {
        success: false,
        response: "Mensagem vazia recebida",
      };
    }

    // Verifica se é uma mensagem de lembrete
    if (!isReminderMessage(messageBody)) {
      return {
        success: false,
        response: "Não é uma mensagem de lembrete",
      };
    }

    // Faz o parse da mensagem
    const parsedReminder = parseReminderMessage(messageBody, senderPhone);

    if (!parsedReminder) {
      return {
        success: false,
        response: `❌ Formato de lembrete inválido.

Exemplos de uso:
• #lembrete 15:30 Reunião com cliente
• #lembrete 15:30 25/12 Reunião de final de ano  
• #lembrete amanhã 09:00 Consulta médica
• #lembrete segunda 14:00 Apresentação projeto
• #lembrete 25/12/2024 20:00 Ceia de Natal

Formato: #lembrete [quando] [hora] [mensagem]`,
      };
    }

    // Cria o lembrete no banco de dados
    const reminder = await createReminder({
      message: parsedReminder.message,
      scheduledAt: parsedReminder.scheduledAt,
      phone: parsedReminder.phone,
    });

    const formatDate = (date: Date): string => {
      // Como salvamos horário literal em UTC, exibimos usando UTC para manter o horário original
      return date.toLocaleString("pt-BR", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Verifica se foi reagendado para amanhã
    const wasRescheduled = (parsedReminder.scheduledAt as any)._wasRescheduled;
    const rescheduledNote = wasRescheduled
      ? "\n\n⏰ *Horário já passou hoje, agendado para amanhã.*"
      : "";

    return {
      success: true,
      response: `✅ Lembrete criado com sucesso!

📅 Data: ${formatDate(parsedReminder.scheduledAt)}
💬 Mensagem: ${parsedReminder.message}
📞 Para: ${parsedReminder.phone}${rescheduledNote}

Você receberá uma mensagem no horário agendado.`,
      reminder,
    };
  } catch (error) {
    console.error("Erro ao processar mensagem do webhook:", error);

    return {
      success: false,
      response:
        "❌ Erro interno ao processar lembrete. Tente novamente em alguns minutos.",
    };
  }
}

/**
 * Processa comando #cancelar [número] com sistema de confirmação
 */
export async function processCancelReminderCommand(
  senderPhone: string,
  reminderNumber: number,
  confirmed: boolean = false
): Promise<{ success: boolean; response: string }> {
  try {
    // Busca lembretes pendentes na mesma ordem da listagem
    const pendingReminders = await getPendingRemindersByPhone(senderPhone);

    if (pendingReminders.length === 0) {
      return {
        success: false,
        response: `📝 *Cancelar Lembrete*

❌ Você não tem lembretes pendentes para cancelar.

Para ver seus lembretes: *#lembrar*
Para criar um novo: *#lembrete [hora] [mensagem]*`,
      };
    }

    // Verifica se o número está dentro do range
    if (reminderNumber < 1 || reminderNumber > pendingReminders.length) {
      return {
        success: false,
        response: `📝 *Cancelar Lembrete*

❌ Número inválido. Você tem ${pendingReminders.length} lembrete(s) pendente(s).

Para ver seus lembretes: *#lembrar*
Para cancelar: *#cancelar [número]*

Exemplo: #cancelar 1`,
      };
    }

    // Pega o lembrete a ser cancelado (índice 0-based)
    const reminderToCancel = pendingReminders[reminderNumber - 1];

    // Formata dados do lembrete para exibição
    let cleanMessage = reminderToCancel.message;
    if (cleanMessage.startsWith("🔔 *Lembrete:* ")) {
      cleanMessage = cleanMessage.replace("🔔 *Lembrete:* ", "");
    }

    const maxLength = 60;
    const truncatedMessage =
      cleanMessage.length > maxLength
        ? cleanMessage.substring(0, maxLength) + "..."
        : cleanMessage;

    const formattedDate = reminderToCancel.scheduledAt.toLocaleString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Se não confirmou, pede confirmação
    if (!confirmed) {
      return {
        success: true,
        response: `⚠️ *Confirmar Cancelamento*

Tem certeza que deseja cancelar este lembrete?

🗑️ Lembrete #${reminderNumber}:
📅 ${formattedDate}
💬 ${truncatedMessage}

Para confirmar o cancelamento, digite:
*#cancelar ${reminderNumber} confirmar*

Para manter o lembrete, ignore esta mensagem.`,
      };
    }

    // Se confirmou, efetivamente cancela o lembrete
    await cancelReminderById(reminderToCancel.id);

    return {
      success: true,
      response: `✅ *Lembrete Cancelado*

🗑️ Lembrete #${reminderNumber} cancelado com sucesso:

📅 ${formattedDate}
💬 ${truncatedMessage}

💡 *Dicas:*
• Para ver lembretes: *#lembrar*
• Para criar novo: *#lembrete [hora] [mensagem]*`,
    };
  } catch (error) {
    console.error("Erro ao cancelar lembrete:", error);

    return {
      success: false,
      response:
        "❌ Erro ao cancelar lembrete. Tente novamente em alguns minutos.",
    };
  }
}

/**
 * Processa comando #editar [número] [nova mensagem]
 */
export async function processEditReminderCommand(
  senderPhone: string,
  reminderNumber: number,
  newMessage: string
): Promise<{ success: boolean; response: string }> {
  try {
    // Busca lembretes pendentes na mesma ordem da listagem
    const pendingReminders = await getPendingRemindersByPhone(senderPhone);

    if (pendingReminders.length === 0) {
      return {
        success: false,
        response: `📝 *Editar Lembrete*

❌ Você não tem lembretes pendentes para editar.

Para ver seus lembretes: *#lembrar*
Para criar um novo: *#lembrete [hora] [mensagem]*`,
      };
    }

    // Verifica se o número está dentro do range
    if (reminderNumber < 1 || reminderNumber > pendingReminders.length) {
      return {
        success: false,
        response: `📝 *Editar Lembrete*

❌ Número inválido. Você tem ${pendingReminders.length} lembrete(s) pendente(s).

Para ver seus lembretes: *#lembrar*
Para editar: *#editar [número] [nova mensagem]*

Exemplo: #editar 1 Nova mensagem`,
      };
    }

    // Pega o lembrete a ser editado (índice 0-based)
    const reminderToEdit = pendingReminders[reminderNumber - 1];

    // Formata data para exibição
    const formattedDate = reminderToEdit.scheduledAt.toLocaleString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Obter mensagem anterior para comparação
    let oldMessage = reminderToEdit.message;
    if (oldMessage.startsWith("🔔 *Lembrete:* ")) {
      oldMessage = oldMessage.replace("🔔 *Lembrete:* ", "");
    }

    // Edita o lembrete no banco de dados
    await editReminderById(reminderToEdit.id, newMessage);

    // Trunca mensagens para exibição
    const maxLength = 40;
    const truncatedOldMessage = oldMessage.length > maxLength 
      ? oldMessage.substring(0, maxLength) + "..." 
      : oldMessage;
    const truncatedNewMessage = newMessage.length > maxLength 
      ? newMessage.substring(0, maxLength) + "..." 
      : newMessage;

    return {
      success: true,
      response: `✅ *Lembrete Editado*

📝 Lembrete #${reminderNumber} editado com sucesso:

📅 ${formattedDate}

📝 *Mensagem anterior:*
${truncatedOldMessage}

✏️ *Nova mensagem:*
${truncatedNewMessage}

💡 *Dicas:*
• Para ver lembretes: *#lembrar*
• Para cancelar: *#cancelar [número]*
• Para criar novo: *#lembrete [hora] [mensagem]*`,
    };
  } catch (error) {
    console.error("Erro ao editar lembrete:", error);

    return {
      success: false,
      response:
        "❌ Erro ao editar lembrete. Tente novamente em alguns minutos.",
    };
  }
}

/**
 * Processa comando #lembrar e retorna lista de lembretes pendentes
 */
export async function processListRemindersCommand(
  senderPhone: string
): Promise<{ success: boolean; response: string }> {
  try {
    const pendingReminders = await getPendingRemindersByPhone(senderPhone);

    if (pendingReminders.length === 0) {
      return {
        success: true,
        response: `📝 *Seus Lembretes*

🎉 Você não tem lembretes pendentes!

Para criar um novo lembrete, use:
*#lembrete [hora] [mensagem]*

Exemplo: #lembrete 15:30 Reunião importante`,
      };
    }

    const formattedList = formatRemindersList(pendingReminders);

    return {
      success: true,
      response: `📝 *Seus Lembretes Pendentes*

${formattedList}

💡 *Dicas:*
• Para criar: *#lembrete [hora] [mensagem]*
• Para cancelar: *#cancelar [número]* (pede confirmação)
• Para ajuda: *#lembrete*`,
    };
  } catch (error) {
    console.error("Erro ao buscar lembretes:", error);

    return {
      success: false,
      response:
        "❌ Erro ao buscar seus lembretes. Tente novamente em alguns minutos.",
    };
  }
}

/**
 * Formata lista de lembretes para exibição no WhatsApp
 */
function formatRemindersList(reminders: Reminder[]): string {
  return reminders
    .map((reminder, index) => {
      const date = reminder.scheduledAt;
      const formattedDate = date.toLocaleString("pt-BR", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Remove o prefixo "🔔 *Lembrete:* " se existir para mostrar apenas a mensagem original
      let cleanMessage = reminder.message;
      if (cleanMessage.startsWith("🔔 *Lembrete:* ")) {
        cleanMessage = cleanMessage.replace("🔔 *Lembrete:* ", "");
      }

      // Trunca mensagem se for muito longa
      const maxLength = 50;
      const truncatedMessage =
        cleanMessage.length > maxLength
          ? cleanMessage.substring(0, maxLength) + "..."
          : cleanMessage;

      return `${index + 1}. 📅 ${formattedDate}
   💬 ${truncatedMessage}`;
    })
    .join("\n\n");
}

/**
 * Gera mensagem de ajuda sobre como usar o comando #lembrete
 */
export function generateHelpMessage(): string {
  return `🤖 *Ajuda - Comandos*

📝 *Para criar um lembrete:*
*#lembrete [quando] [hora] [mensagem]*

📋 *Para listar lembretes:*
*#lembrar*

🗑️ *Para cancelar um lembrete:*
*#cancelar [número]*

✏️ *Para editar um lembrete:*
*#editar [número] [nova mensagem]*

📅 *Exemplos de uso:*

⏰ *Criar lembretes:*
• #lembrete 15:30 Reunião com cliente
• #lembrete 09:00 Tomar remédio
• #lembrete amanhã 07:00 Academia

📋 *Gerenciar lembretes:*
• #lembrar (lista todos)
• #cancelar 1 (pede confirmação)
• #cancelar 1 confirmar (cancela definitivamente)
• #editar 1 Nova mensagem (altera o texto)

⚡ *Dicas:*
• Use horário no formato 24h (ex: 14:30)
• Datas no formato DD/MM ou DD/MM/AAAA
• Se o horário já passou hoje, será agendado para amanhã
• Cancelamentos pedem confirmação para evitar acidentes
• Os números correspondem à ordem em *#lembrar*

❓ *Dúvidas?* Envie uma mensagem com *#lembrete* para ver esta ajuda novamente.`;
}
