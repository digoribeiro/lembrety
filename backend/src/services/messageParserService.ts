import { createReminder } from "./reminderService";

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
  return messageBody.toLowerCase().includes('#lembrete');
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
export function parseReminderMessage(messageBody: string, senderPhone: string): ParsedReminder | null {
  try {
    // Remove o #lembrete do início
    const content = messageBody.replace(/#lembrete\s*/i, '').trim();
    
    if (!content) {
      throw new Error('Conteúdo do lembrete não pode estar vazio');
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
    let reminderText = '';

    for (const pattern of patterns) {
      const match = content.match(pattern);
      
      if (match) {
        scheduledAt = parseDateTime(match);
        reminderText = extractMessage(match);
        break;
      }
    }

    if (!scheduledAt || !reminderText) {
      throw new Error('Formato de lembrete inválido. Use: #lembrete HH:MM Mensagem ou #lembrete DD/MM HH:MM Mensagem');
    }

    return {
      phone: senderPhone,
      message: reminderText.trim(),
      scheduledAt
    };

  } catch (error) {
    console.error('Erro ao fazer parse da mensagem de lembrete:', error);
    return null;
  }
}

/**
 * Cria data salvando horário literal como UTC (simula UTC-3)
 */
function createLiteralDate(year: number, month: number, day: number, hour: number, minute: number): Date {
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
      
      const date = createLiteralDate(currentYear, currentMonth, currentDate, hour, minute);
      
      // Se o horário já passou hoje, agenda para amanhã
      const nowUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 
        now.getHours(), now.getMinutes()));
      if (date <= nowUTC) {
        date.setDate(date.getDate() + 1);
      }
      
      return validateDate(date);
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
      
      const date = createLiteralDate(currentYear, currentMonth, currentDate, hour, minute);
      
      if (dayWord === 'hoje') {
        const nowUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 
          now.getHours(), now.getMinutes()));
        if (date <= nowUTC) {
          date.setDate(date.getDate() + 1); // Se já passou, agenda para amanhã
        }
      } else if (dayWord === 'amanhã') {
        date.setDate(date.getDate() + 1);
      } else {
        // Dias da semana
        const dayMap: { [key: string]: number } = {
          'domingo': 0, 'segunda': 1, 'terça': 2, 'quarta': 3,
          'quinta': 4, 'sexta': 5, 'sábado': 6
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
      
      return validateDate(date);
    }

    return null;
  } catch (error) {
    console.error('Erro ao fazer parse da data/hora:', error);
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
  return '';
}

/**
 * Valida se a data é válida e não está no passado
 */
function validateDate(date: Date): Date | null {
  if (isNaN(date.getTime())) {
    return null;
  }
  
  const now = new Date();
  if (date <= now) {
    // Se a data já passou, adiciona um dia
    date.setDate(date.getDate() + 1);
  }
  
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
        response: 'Mensagem vazia recebida'
      };
    }

    // Verifica se é uma mensagem de lembrete
    if (!isReminderMessage(messageBody)) {
      return {
        success: false,
        response: 'Não é uma mensagem de lembrete'
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

Formato: #lembrete [quando] [hora] [mensagem]`
      };
    }

    // Cria o lembrete no banco de dados
    const reminder = await createReminder({
      message: parsedReminder.message,
      scheduledAt: parsedReminder.scheduledAt,
      phone: parsedReminder.phone
    });

    const formatDate = (date: Date): string => {
      // Como salvamos horário literal em UTC, exibimos usando UTC para manter o horário original
      return date.toLocaleString('pt-BR', {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return {
      success: true,
      response: `✅ Lembrete criado com sucesso!

📅 Data: ${formatDate(parsedReminder.scheduledAt)}
💬 Mensagem: ${parsedReminder.message}
📞 Para: ${parsedReminder.phone}

Você receberá uma mensagem no horário agendado.`,
      reminder
    };

  } catch (error) {
    console.error('Erro ao processar mensagem do webhook:', error);
    
    return {
      success: false,
      response: '❌ Erro interno ao processar lembrete. Tente novamente em alguns minutos.'
    };
  }
}

/**
 * Gera mensagem de ajuda sobre como usar o comando #lembrete
 */
export function generateHelpMessage(): string {
  return `🤖 *Ajuda - Comando #lembrete*

Para criar um lembrete, use o formato:
*#lembrete [quando] [hora] [mensagem]*

📅 *Exemplos de uso:*

⏰ *Hoje:*
• #lembrete 15:30 Reunião com cliente
• #lembrete 09:00 Tomar remédio

📆 *Data específica:*
• #lembrete 25/12 20:00 Ceia de Natal
• #lembrete 15/01/2024 14:30 Consulta médica

🗓️ *Dias da semana:*
• #lembrete segunda 09:00 Reunião de equipe
• #lembrete sexta 18:00 Happy hour
• #lembrete amanhã 07:00 Academia

⚡ *Dicas:*
• Use horário no formato 24h (ex: 14:30)
• Datas no formato DD/MM ou DD/MM/AAAA
• Se o horário já passou hoje, será agendado para amanhã
• Mensagem pode ter qualquer tamanho

❓ *Dúvidas?* Envie uma mensagem com *#lembrete* para ver esta ajuda novamente.`;
} 