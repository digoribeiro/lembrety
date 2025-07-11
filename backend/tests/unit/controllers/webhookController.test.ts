import { Request, Response } from 'express';
import {
  handleEvolutionWebhook,
  webhookStatus,
  testWebhook
} from '../../../src/controllers/webhookController';

// Mock das dependências
jest.mock('../../../src/services/messageParserService', () => ({
  processWebhookMessage: jest.fn(),
  generateHelpMessage: jest.fn(),
  isListRemindersMessage: jest.fn(),
  processListRemindersCommand: jest.fn(),
  isCancelReminderMessage: jest.fn(),
  parseCancelReminderCommand: jest.fn(),
  processCancelReminderCommand: jest.fn(),
  isEditReminderMessage: jest.fn(),
  parseEditReminderCommand: jest.fn(),
  processEditReminderCommand: jest.fn(),
  isRescheduleReminderMessage: jest.fn(),
  parseRescheduleReminderCommand: jest.fn(),
  processRescheduleReminderCommand: jest.fn(),
}));

jest.mock('../../../src/services/evolutionService', () => ({
  sendWhatsAppMessage: jest.fn(),
}));

import {
  processWebhookMessage,
  generateHelpMessage,
  isListRemindersMessage,
  processListRemindersCommand,
  isCancelReminderMessage,
  parseCancelReminderCommand,
  processCancelReminderCommand,
  isEditReminderMessage,
  parseEditReminderCommand,
  processEditReminderCommand,
  isRescheduleReminderMessage,
  parseRescheduleReminderCommand,
  processRescheduleReminderCommand
} from '../../../src/services/messageParserService';

import { sendWhatsAppMessage } from '../../../src/services/evolutionService';

const mockProcessWebhookMessage = processWebhookMessage as jest.MockedFunction<typeof processWebhookMessage>;
const mockGenerateHelpMessage = generateHelpMessage as jest.MockedFunction<typeof generateHelpMessage>;
const mockIsListRemindersMessage = isListRemindersMessage as jest.MockedFunction<typeof isListRemindersMessage>;
const mockProcessListRemindersCommand = processListRemindersCommand as jest.MockedFunction<typeof processListRemindersCommand>;
const mockIsCancelReminderMessage = isCancelReminderMessage as jest.MockedFunction<typeof isCancelReminderMessage>;
const mockParseCancelReminderCommand = parseCancelReminderCommand as jest.MockedFunction<typeof parseCancelReminderCommand>;
const mockProcessCancelReminderCommand = processCancelReminderCommand as jest.MockedFunction<typeof processCancelReminderCommand>;
const mockIsEditReminderMessage = isEditReminderMessage as jest.MockedFunction<typeof isEditReminderMessage>;
const mockParseEditReminderCommand = parseEditReminderCommand as jest.MockedFunction<typeof parseEditReminderCommand>;
const mockProcessEditReminderCommand = processEditReminderCommand as jest.MockedFunction<typeof processEditReminderCommand>;
const mockIsRescheduleReminderMessage = isRescheduleReminderMessage as jest.MockedFunction<typeof isRescheduleReminderMessage>;
const mockParseRescheduleReminderCommand = parseRescheduleReminderCommand as jest.MockedFunction<typeof parseRescheduleReminderCommand>;
const mockProcessRescheduleReminderCommand = processRescheduleReminderCommand as jest.MockedFunction<typeof processRescheduleReminderCommand>;
const mockSendWhatsAppMessage = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>;

describe('WebhookController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    
    // Mock console.log/error para evitar spam nos testes
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleEvolutionWebhook', () => {
    const createMockWebhookPayload = (messageText: string, fromMe = false) => ({
      event: 'message.upsert',
      instance: 'test-instance',
      data: {
        key: {
          fromMe,
          id: 'message-id',
          remoteJid: '5521964660801@s.whatsapp.net'
        },
        message: {
          conversation: messageText
        },
        messageType: 'conversation',
        instanceId: 'test-instance'
      }
    });

    beforeEach(() => {
      mockSendWhatsAppMessage.mockResolvedValue(undefined);
      
      // Configurar defaults para evitar erros em testes que não configuram esses mocks
      mockIsEditReminderMessage.mockReturnValue(false);
      mockIsCancelReminderMessage.mockReturnValue(false);
      mockIsListRemindersMessage.mockReturnValue(false);
      mockIsRescheduleReminderMessage.mockReturnValue(false);
    });

    it('deve responder com status 200 imediatamente', async () => {
      mockRequest = {
        body: createMockWebhookPayload('teste')
      };

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({ received: true });
    });

    it('deve processar comando #lembrete de criação', async () => {
      const payload = createMockWebhookPayload('#lembrete 15:30 Reunião');
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockResolvedValue({
        success: true,
        response: '✅ Lembrete criado com sucesso!'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).toHaveBeenCalledWith({
        from: '5521964660801',
        text: { body: '#lembrete 15:30 Reunião' },
        timestamp: expect.any(String),
        type: 'text'
      });

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '✅ Lembrete criado com sucesso!'
      });
    });

    it('deve processar comando #lembrete (ajuda)', async () => {
      const payload = createMockWebhookPayload('#lembrete');
      mockRequest = { body: payload };

      const helpMessage = '🤖 *Ajuda - Comandos*\n...';
      mockGenerateHelpMessage.mockReturnValue(helpMessage);

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockGenerateHelpMessage).toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: helpMessage
      });
    });

    it('deve processar comando #lembrar', async () => {
      const payload = createMockWebhookPayload('#lembrar');
      mockRequest = { body: payload };

      mockIsListRemindersMessage.mockReturnValue(true);
      mockProcessListRemindersCommand.mockResolvedValue({
        success: true,
        response: '📝 *Seus Lembretes Pendentes*\n1. Reunião...'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockIsListRemindersMessage).toHaveBeenCalledWith('#lembrar');
      expect(mockProcessListRemindersCommand).toHaveBeenCalledWith('5521964660801');
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '📝 *Seus Lembretes Pendentes*\n1. Reunião...'
      });
    });

    it('deve processar comando #cancelar simples (solicitar confirmação)', async () => {
      const payload = createMockWebhookPayload('#cancelar 1');
      mockRequest = { body: payload };

      mockIsCancelReminderMessage.mockReturnValue(true);
      mockParseCancelReminderCommand.mockReturnValue({ number: 1, confirmed: false });
      mockProcessCancelReminderCommand.mockResolvedValue({
        success: true,
        response: '⚠️ *Confirmar Cancelamento*\nTem certeza que deseja cancelar este lembrete?'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockIsCancelReminderMessage).toHaveBeenCalledWith('#cancelar 1');
      expect(mockParseCancelReminderCommand).toHaveBeenCalledWith('#cancelar 1');
      expect(mockProcessCancelReminderCommand).toHaveBeenCalledWith('5521964660801', 1, false);
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '⚠️ *Confirmar Cancelamento*\nTem certeza que deseja cancelar este lembrete?'
      });
    });

    it('deve processar comando #cancelar com confirmação', async () => {
      const payload = createMockWebhookPayload('#cancelar 1 confirmar');
      mockRequest = { body: payload };

      mockIsCancelReminderMessage.mockReturnValue(true);
      mockParseCancelReminderCommand.mockReturnValue({ number: 1, confirmed: true });
      mockProcessCancelReminderCommand.mockResolvedValue({
        success: true,
        response: '✅ *Lembrete Cancelado*\nLembrete #1 cancelado com sucesso'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessCancelReminderCommand).toHaveBeenCalledWith('5521964660801', 1, true);
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '✅ *Lembrete Cancelado*\nLembrete #1 cancelado com sucesso'
      });
    });

    it('deve tratar comando #cancelar inválido', async () => {
      const payload = createMockWebhookPayload('#cancelar abc');
      mockRequest = { body: payload };

      mockIsCancelReminderMessage.mockReturnValue(true);
      mockParseCancelReminderCommand.mockReturnValue({ number: null, confirmed: false });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '❌ Formato inválido. Use: *#cancelar [número]*\n\nExemplo: #cancelar 1'
      });
    });

    it('deve processar lembrete com erro de formato', async () => {
      const payload = createMockWebhookPayload('#lembrete formato inválido');
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockResolvedValue({
        success: false,
        response: '❌ Formato de lembrete inválido.'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '❌ Formato de lembrete inválido.'
      });
    });

    it('deve extrair texto de extendedTextMessage', async () => {
      const payload = {
        event: 'message.upsert',
        instance: 'test-instance',
        data: {
          key: {
            fromMe: false,
            id: 'message-id',
            remoteJid: '5521964660801@s.whatsapp.net'
          },
          message: {
            extendedTextMessage: {
              text: '#lembrete 15:30 Teste extended'
            }
          },
          messageType: 'extendedTextMessage',
          instanceId: 'test-instance'
        }
      };
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockResolvedValue({
        success: true,
        response: '✅ Lembrete criado!'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).toHaveBeenCalledWith({
        from: '5521964660801',
        text: { body: '#lembrete 15:30 Teste extended' },
        timestamp: expect.any(String),
        type: 'text'
      });
    });

    it('deve lidar com diferentes formatos de remoteJid', async () => {
      const payload = {
        ...createMockWebhookPayload('teste'),
        data: {
          ...createMockWebhookPayload('teste').data,
          key: {
            fromMe: false,
            id: 'message-id',
            remoteJid: '5521964660801@c.us'
          }
        }
      };
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockResolvedValue({
        success: true,
        response: 'Teste'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '5521964660801'
        })
      );
    });

    it('deve ignorar mensagem sem texto', async () => {
      const payload = {
        event: 'message.upsert',
        instance: 'test-instance',
        data: {
          key: {
            fromMe: false,
            id: 'message-id',
            remoteJid: '5521964660801@s.whatsapp.net'
          },
          message: {},
          messageType: 'imageMessage',
          instanceId: 'test-instance'
        }
      };
      mockRequest = { body: payload };

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it('deve ignorar mensagem sem remoteJid', async () => {
      const payload = {
        event: 'message.upsert',
        instance: 'test-instance',
        data: {
          key: {
            fromMe: false,
            id: 'message-id'
          },
          message: {
            conversation: 'teste'
          },
          messageType: 'conversation',
          instanceId: 'test-instance'
        }
      };
      mockRequest = { body: payload };

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).not.toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it('deve tratar erro no processamento de webhook', async () => {
      const payload = createMockWebhookPayload('#lembrete 15:30 Teste');
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockRejectedValue(new Error('Erro no processamento'));

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: '5521964660801',
        message: '❌ Erro interno do sistema. Tente novamente em alguns minutos.'
      });
    });

    it('deve tratar erro no envio da resposta de erro', async () => {
      const payload = createMockWebhookPayload('#lembrete 15:30 Teste');
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockRejectedValue(new Error('Erro no processamento'));
      mockSendWhatsAppMessage.mockRejectedValue(new Error('Erro no envio'));

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      // Verifica se houve erro no processamento principal
      expect(console.error).toHaveBeenCalledWith(
        '[Webhook] Erro ao processar webhook:',
        expect.any(Error)
      );
      
      // Verifica se houve tentativa de envio de resposta que falhou
      expect(console.error).toHaveBeenCalledWith(
        '[Webhook] Erro ao enviar resposta para 5521964660801:',
        expect.any(Error)
      );
    });

    it('deve tratar erro quando não consegue extrair número do telefone', async () => {
      const payload = {
        event: 'message.upsert',
        instance: 'test-instance',
        data: {
          key: {
            fromMe: false,
            id: 'message-id'
          },
          message: {
            conversation: '#lembrete 15:30 Teste'
          },
          messageType: 'conversation',
          instanceId: 'test-instance'
        }
      };
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockRejectedValue(new Error('Erro geral'));

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      // Não deve tentar enviar resposta de erro pois não conseguiu extrair o telefone
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it('deve processar mensagens não relacionadas a lembretes sem responder', async () => {
      const payload = createMockWebhookPayload('Olá, como vai?');
      mockRequest = { body: payload };

      mockProcessWebhookMessage.mockResolvedValue({
        success: false,
        response: 'Não é uma mensagem de lembrete'
      });

      await handleEvolutionWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockProcessWebhookMessage).toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });
  });

  describe('webhookStatus', () => {
    it('deve retornar status ativo', async () => {
      await webhookStatus(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        status: 'active',
        timestamp: expect.any(String),
        message: 'Webhook está funcionando corretamente'
      });
    });
  });

  describe('testWebhook', () => {
    beforeEach(() => {
      mockSendWhatsAppMessage.mockResolvedValue(undefined);
    });

    it('deve testar criação de lembrete', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#lembrete 15:30 Teste manual'
        }
      };

      mockProcessWebhookMessage.mockResolvedValue({
        success: true,
        response: '✅ Lembrete criado com sucesso!'
      });

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        result: {
          success: true,
          response: '✅ Lembrete criado com sucesso!'
        }
      });
    });

    it('deve testar comando #lembrar', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#lembrar'
        }
      };

      mockIsListRemindersMessage.mockReturnValue(true);
      mockProcessListRemindersCommand.mockResolvedValue({
        success: true,
        response: '📝 *Seus Lembretes*'
      });

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        result: {
          success: true,
          response: '📝 *Seus Lembretes*'
        }
      });
    });

    it('deve testar comando #cancelar', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#cancelar 1'
        }
      };

      mockIsCancelReminderMessage.mockReturnValue(true);
      mockParseCancelReminderCommand.mockReturnValue({ number: 1, confirmed: false });
      mockProcessCancelReminderCommand.mockResolvedValue({
        success: true,
        response: '⚠️ Confirmar cancelamento'
      });

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        result: {
          success: true,
          response: '⚠️ Confirmar cancelamento'
        }
      });
    });

    it('deve testar comando #cancelar inválido', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#cancelar abc'
        }
      };

      mockIsCancelReminderMessage.mockReturnValue(true);
      mockParseCancelReminderCommand.mockReturnValue({ number: null, confirmed: false });

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        result: {
          success: false,
          response: '❌ Formato inválido. Use: *#cancelar [número]*\n\nExemplo: #cancelar 1'
        }
      });
    });

    it('deve testar comando de ajuda', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#lembrete'
        }
      };

      const helpMessage = '🤖 *Ajuda - Comandos*';
      mockGenerateHelpMessage.mockReturnValue(helpMessage);

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        result: {
          success: true,
          response: helpMessage
        }
      });
    });

    it('deve retornar erro 400 se phone estiver faltando', async () => {
      mockRequest = {
        body: {
          message: '#lembrete 15:30 Teste'
        }
      };

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'phone e message são obrigatórios'
      });
    });

    it('deve retornar erro 400 se message estiver faltando', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801'
        }
      };

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'phone e message são obrigatórios'
      });
    });

    it('deve tratar erro interno', async () => {
      mockRequest = {
        body: {
          phone: '5521964660801',
          message: '#lembrete 15:30 Teste'
        }
      };

      mockProcessWebhookMessage.mockRejectedValue(new Error('Erro interno'));

      await testWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Erro interno do servidor'
      });
    });
  });

  describe('Funções auxiliares', () => {
    it('deve extrair texto corretamente de conversation', () => {
      // Estes testes são implícitos através dos testes do handleEvolutionWebhook
      // mas podemos testar cenários específicos
      const payload = createMockWebhookPayload('texto de teste');
      expect(payload.data.message?.conversation).toBe('texto de teste');
    });

    it('deve extrair número de telefone corretamente', () => {
      // Testado implicitamente através dos outros testes
      // O telefone é extraído corretamente nos casos de teste acima
    });
  });

  // Helper function para criar payloads de teste
  function createMockWebhookPayload(messageText: string, fromMe = false) {
    return {
      event: 'message.upsert',
      instance: 'test-instance',
      data: {
        key: {
          fromMe,
          id: 'message-id',
          remoteJid: '5521964660801@s.whatsapp.net'
        },
        message: {
          conversation: messageText
        },
        messageType: 'conversation',
        instanceId: 'test-instance'
      }
    };
  }
}); 