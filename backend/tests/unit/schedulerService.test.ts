// Mock das dependências antes das importações
const mockPrismaClient = {
  reminder: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockCronSchedule = jest.fn();
const mockSendWhatsAppMessage = jest.fn();

// Mock dos módulos
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock('node-cron', () => ({
  schedule: mockCronSchedule,
}));

jest.mock('../../src/services/evolutionService', () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

// Importar após os mocks
import { startScheduler, checkPendingReminders, processReminder } from '../../src/services/schedulerService';

describe('SchedulerService', () => {
  // Mock data
  const mockReminder = {
    id: 'reminder-123',
    message: 'Lembrete de teste',
    phone: '5511999999999',
    scheduledAt: new Date(Date.now() - 60000), // 1 minuto atrás
    isSent: false,
    createdAt: new Date(),
    sentAt: null,
    retryCount: 0,
    lastError: null,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('startScheduler', () => {
    it('deve iniciar o scheduler com configurações corretas', () => {
      // Act
      startScheduler();

      // Assert
      expect(mockCronSchedule).toHaveBeenCalledTimes(1);
      expect(mockCronSchedule).toHaveBeenCalledWith(
        '* * * * *', // A cada minuto
        expect.any(Function)
      );
    });

    it('deve logar mensagem de início', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      startScheduler();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('[Scheduler] Iniciando serviço de agendamento...');
    });
  });

  describe('checkPendingReminders', () => {
    it('deve processar lembretes pendentes com sucesso', async () => {
      // Arrange
      const reminders = [mockReminder];
      mockPrismaClient.reminder.findMany.mockResolvedValue(reminders);
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      // Act
      await checkPendingReminders();

      // Assert
      expect(mockPrismaClient.reminder.findMany).toHaveBeenCalledWith({
        where: {
          scheduledAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          isSent: false,
          OR: [{ retryCount: { lt: 3 } }, { retryCount: null }],
        },
        take: 100,
      });

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: mockReminder.phone,
        message: mockReminder.message,
      });

      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: mockReminder.id },
        data: {
          isSent: true,
          sentAt: expect.any(Date),
          retryCount: 0,
        },
      });
    });

    it('deve lidar com nenhum lembrete pendente', async () => {
      // Arrange
      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      await checkPendingReminders();

      // Assert
      expect(mockPrismaClient.reminder.findMany).toHaveBeenCalled();
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
      expect(mockPrismaClient.reminder.update).not.toHaveBeenCalled();
    });

    it('deve processar múltiplos lembretes', async () => {
      // Arrange
      const reminder1 = { ...mockReminder, id: 'reminder-1' };
      const reminder2 = { ...mockReminder, id: 'reminder-2', phone: '5511888888888' };
      const reminders = [reminder1, reminder2];

      mockPrismaClient.reminder.findMany.mockResolvedValue(reminders);
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      // Act
      await checkPendingReminders();

      // Assert
      expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(2);
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledTimes(2);
      
      expect(mockSendWhatsAppMessage).toHaveBeenNthCalledWith(1, {
        phone: reminder1.phone,
        message: reminder1.message,
      });
      
      expect(mockSendWhatsAppMessage).toHaveBeenNthCalledWith(2, {
        phone: reminder2.phone,
        message: reminder2.message,
      });
    });

    it('deve tratar erro na busca de lembretes', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error');
      mockPrismaClient.reminder.findMany.mockRejectedValue(new Error('Erro no banco'));

      // Act
      await checkPendingReminders();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Scheduler] Erro ao processar lembretes:',
        'Erro no banco'
      );
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled();
    });

    it('deve logar informações sobre lembretes encontrados', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      const reminders = [mockReminder];
      mockPrismaClient.reminder.findMany.mockResolvedValue(reminders);
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      // Act
      await checkPendingReminders();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Scheduler] Encontrados 1 lembretes para envio imediato')
      );
    });

    it('deve calcular corretamente os horários com ajuste de fuso', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      await checkPendingReminders();

      // Assert - Verifica se os logs mostram o ajuste correto de fuso horário
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Scheduler] Horário do servidor:'),
        expect.stringContaining('| Horário real (Brasília):')
      );
    });

    it('deve usar janela de tempo correta na query', async () => {
      // Arrange
      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      await checkPendingReminders();

      // Assert
      const findManyCall = mockPrismaClient.reminder.findMany.mock.calls[0][0];
      const whereClause = findManyCall.where;
      
      expect(whereClause.scheduledAt).toHaveProperty('gte');
      expect(whereClause.scheduledAt).toHaveProperty('lte');
      expect(whereClause.scheduledAt.gte).toBeInstanceOf(Date);
      expect(whereClause.scheduledAt.lte).toBeInstanceOf(Date);
    });

    it('deve filtrar corretamente lembretes já enviados e com retry > 3', async () => {
      // Arrange
      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      await checkPendingReminders();

      // Assert
      const findManyCall = mockPrismaClient.reminder.findMany.mock.calls[0][0];
      const whereClause = findManyCall.where;
      
      expect(whereClause.isSent).toBe(false);
      expect(whereClause.OR).toEqual([
        { retryCount: { lt: 3 } },
        { retryCount: null }
      ]);
    });

    it('deve lidar com limite de 100 lembretes', async () => {
      // Arrange
      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      await checkPendingReminders();

      // Assert
      expect(mockPrismaClient.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('processReminder', () => {
    it('deve processar lembrete com sucesso', async () => {
      // Arrange
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith({
        phone: mockReminder.phone,
        message: mockReminder.message,
      });

      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: mockReminder.id },
        data: {
          isSent: true,
          sentAt: expect.any(Date),
          retryCount: 0,
        },
      });
    });

    it('deve tratar erro no envio de mensagem e incrementar retry count', async () => {
      // Arrange
      const reminderWithRetry = { ...mockReminder, retryCount: 1 };
      mockPrismaClient.reminder.update.mockResolvedValue(reminderWithRetry);
      mockSendWhatsAppMessage.mockRejectedValue(new Error('Falha no envio'));

      // Act
      await processReminder(reminderWithRetry);

      // Assert
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: reminderWithRetry.id },
        data: {
          retryCount: 2, // Incrementa de 1 para 2
          lastError: 'Falha no envio',
        },
      });

      // Não deve marcar como enviado em caso de erro
      expect(mockPrismaClient.reminder.update).not.toHaveBeenCalledWith({
        where: { id: reminderWithRetry.id },
        data: expect.objectContaining({
          isSent: true,
        }),
      });
    });

    it('deve tratar retryCount null como 0', async () => {
      // Arrange
      const reminderWithNullRetry = { ...mockReminder, retryCount: null };
      mockPrismaClient.reminder.update.mockResolvedValue(reminderWithNullRetry);
      mockSendWhatsAppMessage.mockRejectedValue(new Error('Falha no envio'));

      // Act
      await processReminder(reminderWithNullRetry);

      // Assert
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: reminderWithNullRetry.id },
        data: {
          retryCount: 1, // null + 1 = 1
          lastError: 'Falha no envio',
        },
      });
    });

    it('deve tratar erro de string', async () => {
      // Arrange
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockRejectedValue('Erro string');

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: mockReminder.id },
        data: {
          retryCount: 1,
          lastError: 'Erro string',
        },
      });
    });

    it('deve tratar erro desconhecido', async () => {
      // Arrange
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockRejectedValue({ unknownError: true });

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: mockReminder.id },
        data: {
          retryCount: 1,
          lastError: 'Erro desconhecido',
        },
      });
    });

    it('deve truncar lastError se for muito longo', async () => {
      // Arrange
      const longError = 'a'.repeat(300); // Erro com 300 caracteres
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockRejectedValue(new Error(longError));

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(mockPrismaClient.reminder.update).toHaveBeenCalledWith({
        where: { id: mockReminder.id },
        data: {
          retryCount: 1,
          lastError: longError.substring(0, 255), // Truncado para 255 chars
        },
      });
    });

    it('deve logar informações do lembrete durante processamento', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockResolvedValue({ key: { id: 'msg-123' } });

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `[Scheduler] Enviando lembrete ${mockReminder.id} para ${mockReminder.phone}`
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `[Scheduler] Lembrete ${mockReminder.id} enviado com sucesso`
      );
    });

    it('deve logar erros durante processamento', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error');
      mockPrismaClient.reminder.update.mockResolvedValue(mockReminder);
      mockSendWhatsAppMessage.mockRejectedValue(new Error('Falha no envio'));

      // Act
      await processReminder(mockReminder);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        `[Scheduler] Falha no lembrete ${mockReminder.id}:`,
        'Falha no envio'
      );
    });
  });

  describe('Integration tests', () => {
    it('deve executar callback do cron schedule corretamente', async () => {
      // Arrange
      let cronCallback: Function | undefined;
      mockCronSchedule.mockImplementation((interval: string, callback: Function) => {
        cronCallback = callback;
      });

      mockPrismaClient.reminder.findMany.mockResolvedValue([]);

      // Act
      startScheduler();
      if (cronCallback) {
        await cronCallback();
      }

      // Assert
      expect(mockPrismaClient.reminder.findMany).toHaveBeenCalled();
    });

    it('deve tratar erros no callback do cron sem quebrar', async () => {
      // Arrange
      let cronCallback: Function | undefined;
      mockCronSchedule.mockImplementation((interval: string, callback: Function) => {
        cronCallback = callback;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error');
      mockPrismaClient.reminder.findMany.mockRejectedValue(new Error('Erro crítico'));

      // Act
      startScheduler();
      if (cronCallback) {
        await cronCallback();
      }

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Scheduler] Erro ao processar lembretes:',
        'Erro crítico'
      );
    });
  });
}); 