import { Request, Response } from 'express';
import { processWebhookMessage, generateHelpMessage } from '../services/messageParserService';
import { sendWhatsAppMessage } from '../services/evolutionService';

/**
 * Interface para mensagens do Evolution API webhook
 */
interface EvolutionWebhookMessage {
  key: {
    fromMe: boolean;
    id: string;
    remoteJid: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageType: string;
  instanceId: string;
  source?: string;
}

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionWebhookMessage;
}

/**
 * Webhook endpoint para receber mensagens do Evolution API
 */
export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  try {
    console.log('[Webhook] Recebido:', JSON.stringify(req.body, null, 2));

    const payload: EvolutionWebhookPayload = req.body;

    // Responde rapidamente para o Evolution API
    res.status(200).json({ received: true });

    // Verifica se é um evento de mensagem recebida
    if (!isValidMessageEvent(payload)) {
      console.log('[Webhook] Evento ignorado:', payload.event);
      return;
    }

    const message = payload.data;
    
    // Ignora mensagens enviadas por nós mesmos
    if (message.key?.fromMe) {
      console.log('[Webhook] Mensagem própria ignorada');
      return;
    }

    // Extrai o texto da mensagem
    const messageText = extractMessageText(message);
    if (!messageText) {
      console.log('[Webhook] Mensagem sem texto');
      return;
    }

    // Extrai o número do remetente
    const senderPhone = extractSenderPhone(message);
    if (!senderPhone) {
      console.log('[Webhook] Número do remetente não encontrado');
      return;
    }

    console.log(`[Webhook] Processando mensagem de ${senderPhone}: "${messageText}"`);

    // Converte para o formato esperado pelo messageParser
    const webhookMessage = {
      from: senderPhone,
      text: {
        body: messageText
      },
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Processa a mensagem
    const result = await processWebhookMessage(webhookMessage);

    // Se processou com sucesso ou falhou com erro de formato, responde ao usuário
    if (result.success || result.response.includes('❌')) {
      await sendResponseToUser(senderPhone, result.response);
    }

    // Se a mensagem contém apenas "#lembrete" sem mais nada, envia ajuda
    if (messageText.trim().toLowerCase() === '#lembrete') {
      const helpMessage = generateHelpMessage();
      await sendResponseToUser(senderPhone, helpMessage);
    }

  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    
    // Tenta enviar mensagem de erro para o usuário se possível
    try {
      const payload: EvolutionWebhookPayload = req.body;
      const senderPhone = extractSenderPhone(payload.data);
      
      if (senderPhone) {
        await sendResponseToUser(
          senderPhone, 
          '❌ Erro interno do sistema. Tente novamente em alguns minutos.'
        );
      }
    } catch (errorResponse) {
      console.error('[Webhook] Erro ao enviar resposta de erro:', errorResponse);
    }
  }
};

/**
 * Verifica se é um evento de mensagem válido
 */
function isValidMessageEvent(payload: EvolutionWebhookPayload): boolean {
  const validEvents = [
    'message.upsert',
    'messages.upsert', 
    'message.received',
    'messages.received'
  ];
  
  return validEvents.includes(payload.event?.toLowerCase()) && 
         payload.data && 
         payload.data.key &&
         !payload.data.key.fromMe;
}

/**
 * Extrai o texto da mensagem do payload do Evolution API
 */
function extractMessageText(message: EvolutionWebhookMessage): string | null {
  // Tenta diferentes campos onde o texto pode estar
  if (message.message?.conversation) {
    return message.message.conversation;
  }
  
  if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  }

  // Adiciona suporte para outros tipos de mensagem se necessário
  // Aqui podemos adicionar suporte para mensagens de mídia, etc.
  
  return null;
}

/**
 * Extrai o número do telefone do remetente
 */
function extractSenderPhone(message: EvolutionWebhookMessage): string | null {
  if (!message.key?.remoteJid) {
    return null;
  }

  // Remove o sufixo @s.whatsapp.net se presente
  let phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
  
  // Remove outros sufixos do WhatsApp se necessário
  phone = phone.replace('@c.us', '');
  
  return phone;
}

/**
 * Envia resposta para o usuário via WhatsApp
 */
async function sendResponseToUser(phone: string, message: string): Promise<void> {
  try {
    console.log(`[Webhook] Enviando resposta para ${phone}: ${message.substring(0, 50)}...`);
    
    await sendWhatsAppMessage({
      phone,
      message
    });
    
    console.log(`[Webhook] Resposta enviada com sucesso para ${phone}`);
  } catch (error) {
    console.error(`[Webhook] Erro ao enviar resposta para ${phone}:`, error);
  }
}

/**
 * Endpoint para verificar status do webhook (para testes)
 */
export const webhookStatus = async (req: Request, res: Response) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    message: 'Webhook está funcionando corretamente'
  });
};

/**
 * Endpoint para testar o webhook manualmente (para desenvolvimento)
 */
export const testWebhook = async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        error: 'phone e message são obrigatórios'
      });
    }

    const webhookMessage = {
      from: phone,
      text: {
        body: message
      },
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    const result = await processWebhookMessage(webhookMessage);
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('[Webhook] Erro no teste:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}; 