import { Reminder, RecurrenceType } from '@prisma/client';

// Tipo base para mocks do Reminder
export type MockReminder = Reminder;

// Factory para criar mocks de Reminder
export const createMockReminder = (overrides: Partial<MockReminder> = {}): MockReminder => ({
  id: 'mock-reminder-id',
  message: '🔔 *Lembrete:* Mock reminder',
  scheduledAt: new Date('2025-07-11T14:00:00.000Z'),
  phone: '5521999999999',
  isSent: false,
  createdAt: new Date(),
  sentAt: null,
  retryCount: 0,
  lastError: null,
  source: 'api',
  
  // Campos de recorrência
  isRecurring: false,
  recurrenceType: null,
  recurrencePattern: null,
  seriesId: null,
  parentId: null,
  endDate: null,
  
  ...overrides,
});

// Factory para criar mock de lembrete recorrente
export const createMockRecurringReminder = (overrides: Partial<MockReminder> = {}): MockReminder => ({
  ...createMockReminder(),
  isRecurring: true,
  recurrenceType: RecurrenceType.DAILY,
  recurrencePattern: '1',
  seriesId: 'series_123',
  ...overrides,
});

// Arrays de mocks comuns
export const mockReminders = [
  createMockReminder({
    id: '1',
    message: '🔔 *Lembrete:* Reunião importante',
    scheduledAt: new Date('2025-07-11T14:00:00.000Z'),
  }),
  createMockReminder({
    id: '2',
    message: '🔔 *Lembrete:* Ligar para médico',
    scheduledAt: new Date('2025-07-12T09:00:00.000Z'),
  }),
]; 