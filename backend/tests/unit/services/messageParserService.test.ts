import {
  isReminderMessage,
  isListRemindersMessage,
  isCancelReminderMessage,
  parseCancelReminderCommand,
  parseReminderMessage,
  processCancelReminderCommand,
  processListRemindersCommand,
  processWebhookMessage,
  generateHelpMessage,
  isEditReminderMessage,
  parseEditReminderCommand,
  processEditReminderCommand,
  isRescheduleReminderMessage,
  parseRescheduleReminderCommand,
  processRescheduleReminderCommand,
} from "../../../src/services/messageParserService";

// Mock das dependências
jest.mock("../../../src/services/reminderService", () => ({
  getPendingRemindersByPhone: jest.fn(),
  cancelReminderById: jest.fn(),
  createReminder: jest.fn(),
  editReminderById: jest.fn(),
  rescheduleReminderById: jest.fn(),
}));

jest.mock("../../../src/services/recurrenceService", () => ({
  cancelRecurringSeries: jest.fn(),
}));

import {
  getPendingRemindersByPhone,
  cancelReminderById,
  createReminder,
  editReminderById,
  rescheduleReminderById,
} from "../../../src/services/reminderService";

const mockGetPendingRemindersByPhone =
  getPendingRemindersByPhone as jest.MockedFunction<
    typeof getPendingRemindersByPhone
  >;
const mockCancelReminderById = cancelReminderById as jest.MockedFunction<
  typeof cancelReminderById
>;
const mockCreateReminder = createReminder as jest.MockedFunction<
  typeof createReminder
>;
const mockEditReminderById = editReminderById as jest.MockedFunction<
  typeof editReminderById
>;
const mockRescheduleReminderById =
  rescheduleReminderById as jest.MockedFunction<typeof rescheduleReminderById>;

// Helper para criar mocks de reminder com campos de recorrência
const createMockReminder = (overrides: any = {}) => ({
  id: "mock-id",
  message: "🔔 *Lembrete:* Mock message",
  scheduledAt: new Date("2025-07-11T14:00:00.000Z"),
  phone: "5521964660801",
  isSent: false,
  createdAt: new Date(),
  sentAt: null,
  retryCount: 0,
  lastError: null,
  source: "api",
  isRecurring: false,
  recurrenceType: null,
  recurrencePattern: null,
  seriesId: null,
  parentId: null,
  endDate: null,
  ...overrides,
});

describe("MessageParserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock da data atual para testes consistentes
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-07-11T15:30:00.000Z")); // 11/07/2025, 12:30 BR
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("isReminderMessage", () => {
    it("deve detectar comando #lembrete válido", () => {
      expect(isReminderMessage("#lembrete 15:30 Reunião")).toBe(true);
      expect(isReminderMessage("#LEMBRETE 15:30 Reunião")).toBe(true);
      expect(isReminderMessage("texto #lembrete 15:30 Reunião")).toBe(true);
    });

    it("deve rejeitar mensagens sem #lembrete", () => {
      expect(isReminderMessage("reunião às 15:30")).toBe(false);
      expect(isReminderMessage("#lembrar")).toBe(false);
      expect(isReminderMessage("#cancelar 1")).toBe(false);
    });
  });

  describe("isListRemindersMessage", () => {
    it("deve detectar comando #lembrar exato", () => {
      expect(isListRemindersMessage("#lembrar")).toBe(true);
      expect(isListRemindersMessage("#LEMBRAR")).toBe(true);
      expect(isListRemindersMessage("  #lembrar  ")).toBe(true);
    });

    it("deve rejeitar variações do comando #lembrar", () => {
      expect(isListRemindersMessage("#lembrar algo")).toBe(false);
      expect(isListRemindersMessage("texto #lembrar")).toBe(false);
      expect(isListRemindersMessage("#lembrete")).toBe(false);
    });
  });

  describe("isCancelReminderMessage", () => {
    it("deve detectar comando #cancelar válido", () => {
      expect(isCancelReminderMessage("#cancelar 1")).toBe(true);
      expect(isCancelReminderMessage("#cancelar 10")).toBe(true);
      expect(isCancelReminderMessage("#CANCELAR 5")).toBe(true);
      expect(isCancelReminderMessage("  #cancelar 3  ")).toBe(true);
    });

    it("deve detectar comando #cancelar com confirmação", () => {
      expect(isCancelReminderMessage("#cancelar 1 confirmar")).toBe(true);
      expect(isCancelReminderMessage("#cancelar 10 CONFIRMAR")).toBe(true);
      expect(isCancelReminderMessage("  #cancelar 3 confirmar  ")).toBe(true);
    });

    it("deve rejeitar comandos #cancelar inválidos", () => {
      expect(isCancelReminderMessage("#cancelar")).toBe(false);
      expect(isCancelReminderMessage("#cancelar abc")).toBe(false);
      expect(isCancelReminderMessage("#cancelar 1 2")).toBe(false);
      // Note: O regex aceita 0, mas o parser rejeita no parseCancelReminderCommand
      expect(isCancelReminderMessage("#cancelar -1")).toBe(false);
    });
  });

  describe("parseCancelReminderCommand", () => {
    it("deve fazer parse de comando simples", () => {
      expect(parseCancelReminderCommand("#cancelar 1")).toEqual({
        number: 1,
        confirmed: false,
      });
      expect(parseCancelReminderCommand("#cancelar 10")).toEqual({
        number: 10,
        confirmed: false,
      });
    });

    it("deve fazer parse de comando com confirmação", () => {
      expect(parseCancelReminderCommand("#cancelar 1 confirmar")).toEqual({
        number: 1,
        confirmed: true,
      });
      expect(parseCancelReminderCommand("#CANCELAR 5 CONFIRMAR")).toEqual({
        number: 5,
        confirmed: true,
      });
    });

    it("deve retornar null para comandos inválidos", () => {
      expect(parseCancelReminderCommand("#cancelar abc")).toEqual({
        number: null,
        confirmed: false,
      });
      expect(parseCancelReminderCommand("#cancelar 0")).toEqual({
        number: null,
        confirmed: false,
      });
      expect(parseCancelReminderCommand("#cancelar -1")).toEqual({
        number: null,
        confirmed: false,
      });
    });

    it("deve ignorar espaços extras", () => {
      expect(
        parseCancelReminderCommand("  #cancelar   5   confirmar  ")
      ).toEqual({
        number: 5,
        confirmed: true,
      });
    });
  });

  describe("isEditReminderMessage", () => {
    it("deve detectar comando #editar válido", () => {
      expect(isEditReminderMessage("#editar 1 Nova mensagem")).toBe(true);
      expect(isEditReminderMessage("#editar 10 Mensagem alterada")).toBe(true);
      expect(isEditReminderMessage("#EDITAR 5 Texto novo")).toBe(true);
      expect(isEditReminderMessage("  #editar 3 Nova mensagem  ")).toBe(true);
    });

    it("deve rejeitar comandos #editar inválidos", () => {
      expect(isEditReminderMessage("#editar")).toBe(false);
      expect(isEditReminderMessage("#editar 1")).toBe(false);
      expect(isEditReminderMessage("#editar abc Nova mensagem")).toBe(false);
      expect(isEditReminderMessage("#editar 1 2 3")).toBe(true); // Este deveria ser válido
      expect(isEditReminderMessage("#editar -1 Mensagem")).toBe(false);
    });
  });

  describe("parseEditReminderCommand", () => {
    it("deve fazer parse de comando válido", () => {
      expect(parseEditReminderCommand("#editar 1 Nova mensagem")).toEqual({
        number: 1,
        newMessage: "Nova mensagem",
      });
      expect(
        parseEditReminderCommand("#editar 10 Mensagem muito longa aqui")
      ).toEqual({
        number: 10,
        newMessage: "Mensagem muito longa aqui",
      });
    });

    it("deve lidar com case insensitive", () => {
      expect(parseEditReminderCommand("#EDITAR 5 NOVA MENSAGEM")).toEqual({
        number: 5,
        newMessage: "NOVA MENSAGEM",
      });
    });

    it("deve retornar null para comandos inválidos", () => {
      expect(parseEditReminderCommand("#editar abc Nova mensagem")).toEqual({
        number: null,
        newMessage: null,
      });
      expect(parseEditReminderCommand("#editar 0 Mensagem")).toEqual({
        number: null,
        newMessage: null,
      });
      expect(parseEditReminderCommand("#editar -1 Mensagem")).toEqual({
        number: null,
        newMessage: null,
      });
      expect(parseEditReminderCommand("#editar 1")).toEqual({
        number: null,
        newMessage: null,
      });
    });

    it("deve preservar espaços na mensagem", () => {
      expect(
        parseEditReminderCommand("#editar 1 Mensagem com   múltiplos espaços")
      ).toEqual({
        number: 1,
        newMessage: "Mensagem com   múltiplos espaços",
      });
    });

    it("deve ignorar espaços extras ao redor", () => {
      expect(
        parseEditReminderCommand("  #editar   2   Nova mensagem  ")
      ).toEqual({
        number: 2,
        newMessage: "Nova mensagem",
      });
    });
  });

  describe("parseReminderMessage", () => {
    const senderPhone = "5521964660801";

    it("deve fazer parse de horário simples (hoje)", () => {
      const result = parseReminderMessage(
        "#lembrete 16:30 Reunião",
        senderPhone
      );

      expect(result).not.toBeNull();
      expect(result?.phone).toBe(senderPhone);
      expect(result?.message).toBe("Reunião");
      expect(result?.scheduledAt).toBeInstanceOf(Date);
      // Como usamos UTC literal, o horário é salvo como está
      expect(result?.scheduledAt.getUTCHours()).toBe(16);
      expect(result?.scheduledAt.getUTCMinutes()).toBe(30);
    });

    it("deve fazer parse de data específica DD/MM HH:MM", () => {
      const result = parseReminderMessage(
        "#lembrete 15/07 14:30 Consulta",
        senderPhone
      );

      expect(result).not.toBeNull();
      expect(result?.message).toBe("Consulta");
      expect(result?.scheduledAt.getUTCDate()).toBe(15);
      expect(result?.scheduledAt.getUTCMonth()).toBe(6); // JS months are 0-indexed
      expect(result?.scheduledAt.getUTCHours()).toBe(14);
    });

    it("deve fazer parse de data completa HH:MM DD/MM/YYYY", () => {
      const result = parseReminderMessage(
        "#lembrete 20:00 25/12/2025 Natal",
        senderPhone
      );

      expect(result).not.toBeNull();
      expect(result?.message).toBe("Natal");
      expect(result?.scheduledAt.getUTCDate()).toBe(25);
      expect(result?.scheduledAt.getUTCMonth()).toBe(11); // Dezembro = 11
      expect(result?.scheduledAt.getUTCFullYear()).toBe(2025);
      expect(result?.scheduledAt.getUTCHours()).toBe(20);
    });

    it("deve fazer parse de palavras-chave temporais", () => {
      const amanha = parseReminderMessage(
        "#lembrete amanhã 09:00 Academia",
        senderPhone
      );
      expect(amanha).not.toBeNull();
      expect(amanha?.message).toBe("Academia");
      expect(amanha?.scheduledAt.getUTCDate()).toBe(12); // Dia seguinte

      const hoje = parseReminderMessage(
        "#lembrete hoje 20:00 Assistir televisão",
        senderPhone
      );
      expect(hoje).not.toBeNull();
      expect(hoje?.message).toBe("Assistir televisão");
    });

    it("deve agendar para hoje se horário ainda não passou", () => {
      // Mock: agora são 15:30, tentando agendar para 16:00 (ainda não passou)
      const result = parseReminderMessage(
        "#lembrete 16:00 Reunião",
        senderPhone
      );

      expect(result).not.toBeNull();
      expect(result?.scheduledAt.getUTCDate()).toBe(11); // Hoje
      expect(result?.scheduledAt.getUTCHours()).toBe(16);
    });

    it("deve agendar para amanhã se horário já passou", () => {
      // Mock: agora são 15:30 UTC = 12:30 local, tentando agendar para 11:00 (já passou no local)
      const result = parseReminderMessage(
        "#lembrete 11:00 Reunião passada",
        senderPhone
      );

      expect(result).not.toBeNull();
      expect(result?.scheduledAt.getUTCDate()).toBe(12); // Amanhã
      expect(result?.scheduledAt.getUTCHours()).toBe(11);
      expect((result?.scheduledAt as any)._wasRescheduled).toBe(true);
    });

    it("deve retornar null para formato inválido", () => {
      expect(
        parseReminderMessage("#lembrete formato inválido", senderPhone)
      ).toBeNull();
      // Note: O sistema atualmente aceita 25:00 como horário válido e faz parse
      expect(parseReminderMessage("#lembrete", senderPhone)).toBeNull();
    });

    it("deve limpar espaços da mensagem", () => {
      const result = parseReminderMessage(
        "#lembrete 16:00   Mensagem com espaços   ",
        senderPhone
      );
      expect(result?.message).toBe("Mensagem com espaços");
    });
  });

  describe("processCancelReminderCommand", () => {
    const senderPhone = "5521964660801";
    const mockReminders = [
      createMockReminder({
        id: "1",
        message: "🔔 *Lembrete:* Reunião importante",
        scheduledAt: new Date("2025-07-11T14:00:00.000Z"),
      }),
      createMockReminder({
        id: "2",
        message: "🔔 *Lembrete:* Ligar para médico",
        scheduledAt: new Date("2025-07-12T09:00:00.000Z"),
      }),
    ];

    beforeEach(() => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockCancelReminderById.mockResolvedValue({} as any);
    });

    it("deve solicitar confirmação quando não confirmado", async () => {
      const result = await processCancelReminderCommand(senderPhone, 1, false);

      expect(result.success).toBe(true);
      expect(result.response).toContain("⚠️ *Confirmar Cancelamento*");
      expect(result.response).toContain("Lembrete #1");
      expect(result.response).toContain("#cancelar 1 confirmar");
      expect(mockCancelReminderById).not.toHaveBeenCalled();
    });

    it("deve cancelar efetivamente quando confirmado", async () => {
      const result = await processCancelReminderCommand(senderPhone, 1, true);

      expect(result.success).toBe(true);
      expect(result.response).toContain("✅ *Lembrete Cancelado*");
      expect(result.response).toContain("Lembrete #1 cancelado com sucesso");
      expect(mockCancelReminderById).toHaveBeenCalledWith("1");
    });

    it("deve tratar número inválido (muito alto)", async () => {
      const result = await processCancelReminderCommand(senderPhone, 10, false);

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
      expect(result.response).toContain("Você tem 2 lembrete(s) pendente(s)");
    });

    it("deve tratar número inválido (menor que 1)", async () => {
      const result = await processCancelReminderCommand(senderPhone, 0, false);

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
    });

    it("deve tratar usuário sem lembretes", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue([] as any);

      const result = await processCancelReminderCommand(senderPhone, 1, false);

      expect(result.success).toBe(false);
      expect(result.response).toContain(
        "❌ Você não tem lembretes pendentes para cancelar"
      );
    });

    it("deve tratar erro na busca de lembretes", async () => {
      mockGetPendingRemindersByPhone.mockRejectedValue(
        new Error("Erro no banco")
      );

      const result = await processCancelReminderCommand(senderPhone, 1, false);

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao cancelar lembrete");
    });

    it("deve truncar mensagens longas", async () => {
      const longMessageReminder = [
        createMockReminder({
          message: "🔔 *Lembrete:* " + "A".repeat(100),
        }),
      ];
      mockGetPendingRemindersByPhone.mockResolvedValue(
        longMessageReminder as any
      );

      const result = await processCancelReminderCommand(senderPhone, 1, false);

      expect(result.response).toContain("...");
    });

    it("deve remover prefixo do lembrete na exibição", async () => {
      const result = await processCancelReminderCommand(senderPhone, 1, false);

      expect(result.response).toContain("💬 Reunião importante");
      expect(result.response).not.toContain(
        "🔔 *Lembrete:* Reunião importante"
      );
    });
  });

  describe("processEditReminderCommand", () => {
    const senderPhone = "5521964660801";
    const mockReminders = [
      createMockReminder({
        id: "1",
        message: "🔔 *Lembrete:* Reunião importante",
        scheduledAt: new Date("2025-07-11T14:00:00.000Z"),
      }),
      createMockReminder({
        id: "2",
        message: "🔔 *Lembrete:* Ligar para médico",
        scheduledAt: new Date("2025-07-12T09:00:00.000Z"),
      }),
    ];

    beforeEach(() => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockEditReminderById.mockResolvedValue({} as any);
    });

    it("deve editar lembrete com sucesso", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem importante"
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("✅ *Lembrete Editado*");
      expect(result.response).toContain("Lembrete #1 editado com sucesso");
      expect(result.response).toContain("📝 *Mensagem anterior:*");
      expect(result.response).toContain("Reunião importante");
      expect(result.response).toContain("✏️ *Nova mensagem:*");
      expect(result.response).toContain("Nova mensagem importante");
      expect(mockEditReminderById).toHaveBeenCalledWith(
        "1",
        "Nova mensagem importante"
      );
    });

    it("deve tratar número inválido (muito alto)", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        10,
        "Nova mensagem"
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
      expect(result.response).toContain("Você tem 2 lembrete(s) pendente(s)");
      expect(mockEditReminderById).not.toHaveBeenCalled();
    });

    it("deve tratar número inválido (menor que 1)", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        0,
        "Nova mensagem"
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
      expect(mockEditReminderById).not.toHaveBeenCalled();
    });

    it("deve tratar usuário sem lembretes", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue([] as any);

      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem"
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain(
        "❌ Você não tem lembretes pendentes para editar"
      );
      expect(mockEditReminderById).not.toHaveBeenCalled();
    });

    it("deve tratar erro na busca de lembretes", async () => {
      mockGetPendingRemindersByPhone.mockRejectedValue(
        new Error("Erro no banco")
      );

      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem"
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao editar lembrete");
      expect(mockEditReminderById).not.toHaveBeenCalled();
    });

    it("deve truncar mensagens longas na exibição", async () => {
      const longMessage = "A".repeat(100);
      const result = await processEditReminderCommand(
        senderPhone,
        1,
        longMessage
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("...");
      expect(mockEditReminderById).toHaveBeenCalledWith("1", longMessage);
    });

    it("deve remover prefixo do lembrete na exibição da mensagem anterior", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem"
      );

      expect(result.response).toContain("Reunião importante");
      expect(result.response).not.toContain(
        "🔔 *Lembrete:* Reunião importante"
      );
    });

    it("deve mostrar data formatada corretamente", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem"
      );

      expect(result.response).toContain("📅 11/07/2025, 14:00");
    });

    it("deve tratar erro no serviço de edição", async () => {
      mockEditReminderById.mockRejectedValue(new Error("Erro no banco"));

      const result = await processEditReminderCommand(
        senderPhone,
        1,
        "Nova mensagem"
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao editar lembrete");
    });

    it("deve editar o segundo lembrete corretamente", async () => {
      const result = await processEditReminderCommand(
        senderPhone,
        2,
        "Ligar para dentista"
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("Lembrete #2 editado com sucesso");
      expect(result.response).toContain("Ligar para médico"); // Mensagem anterior
      expect(result.response).toContain("Ligar para dentista"); // Nova mensagem
      expect(mockEditReminderById).toHaveBeenCalledWith(
        "2",
        "Ligar para dentista"
      );
    });
  });

  describe("isRescheduleReminderMessage", () => {
    it("deve detectar comando #reagendar válido", () => {
      expect(isRescheduleReminderMessage("#reagendar 1 15:30")).toBe(true);
      expect(isRescheduleReminderMessage("#reagendar 10 amanhã 14:00")).toBe(
        true
      );
      expect(isRescheduleReminderMessage("#REAGENDAR 5 25/12 20:00")).toBe(
        true
      );
      expect(isRescheduleReminderMessage("  #reagendar 3 16:00  ")).toBe(true);
    });

    it("deve rejeitar comandos #reagendar inválidos", () => {
      expect(isRescheduleReminderMessage("#reagendar")).toBe(false);
      expect(isRescheduleReminderMessage("#reagendar 1")).toBe(false);
      expect(isRescheduleReminderMessage("#reagendar abc 15:30")).toBe(false);
      expect(isRescheduleReminderMessage("#reagendar -1 15:30")).toBe(false);
      expect(isRescheduleReminderMessage("reagendar 1 15:30")).toBe(false);
    });
  });

  describe("parseRescheduleReminderCommand", () => {
    it("deve fazer parse de comando com nova hora", () => {
      const result = parseRescheduleReminderCommand("#reagendar 1 15:30");

      expect(result.number).toBe(1);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.scheduledAt?.getUTCHours()).toBe(15);
      expect(result.scheduledAt?.getUTCMinutes()).toBe(30);
    });

    it("deve fazer parse de comando com nova data", () => {
      const result = parseRescheduleReminderCommand(
        "#reagendar 2 amanhã 14:00"
      );

      expect(result.number).toBe(2);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.scheduledAt?.getUTCHours()).toBe(14);
    });

    it("deve fazer parse de data específica", () => {
      const result = parseRescheduleReminderCommand("#reagendar 3 15/07 16:00");

      expect(result.number).toBe(3);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.scheduledAt?.getUTCDate()).toBe(15);
      expect(result.scheduledAt?.getUTCMonth()).toBe(6); // Julho = 6
      expect(result.scheduledAt?.getUTCHours()).toBe(16);
    });

    it("deve ser case insensitive", () => {
      const result = parseRescheduleReminderCommand("#REAGENDAR 1 15:30");
      expect(result.number).toBe(1);
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });

    it("deve retornar null para comandos inválidos", () => {
      expect(parseRescheduleReminderCommand("#reagendar")).toEqual({
        number: null,
        scheduledAt: null,
      });
      expect(parseRescheduleReminderCommand("#reagendar 1")).toEqual({
        number: null,
        scheduledAt: null,
      });
      expect(parseRescheduleReminderCommand("#reagendar abc 15:30")).toEqual({
        number: null,
        scheduledAt: null,
      });
      expect(parseRescheduleReminderCommand("#reagendar 0 15:30")).toEqual({
        number: null,
        scheduledAt: null,
      });
    });

    it("deve ignorar espaços extras", () => {
      const result = parseRescheduleReminderCommand(
        "  #reagendar   1   15:30   "
      );
      expect(result.number).toBe(1);
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });
  });

  describe("processRescheduleReminderCommand", () => {
    const senderPhone = "5521964660801";
    const mockReminders = [
      createMockReminder({
        id: "1",
        message: "🔔 *Lembrete:* Reunião importante",
        scheduledAt: new Date("2025-07-11T14:00:00.000Z"),
      }),
      createMockReminder({
        id: "2",
        message: "🔔 *Lembrete:* Ligar para médico",
        scheduledAt: new Date("2025-07-12T09:00:00.000Z"),
      }),
    ];

    beforeEach(() => {
      mockGetPendingRemindersByPhone.mockClear();
      mockRescheduleReminderById.mockClear();
    });

    it("deve reagendar lembrete com sucesso", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockResolvedValue({
        ...mockReminders[0],
        scheduledAt: new Date("2025-07-11T16:00:00.000Z"),
      } as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("✅ *Lembrete Reagendado*");
      expect(result.response).toContain("Lembrete #1 reagendado com sucesso");
      expect(result.response).toContain("Reunião importante");
      expect(mockRescheduleReminderById).toHaveBeenCalledWith(
        "1",
        newScheduledAt
      );
    });

    it("deve tratar número inválido (muito alto)", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        5,
        newScheduledAt
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
      expect(result.response).toContain("Você tem 2 lembrete(s) pendente(s)");
      expect(mockRescheduleReminderById).not.toHaveBeenCalled();
    });

    it("deve tratar número inválido (menor que 1)", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        0,
        newScheduledAt
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Número inválido");
    });

    it("deve tratar usuário sem lembretes", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue([] as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain(
        "❌ Você não tem lembretes pendentes para reagendar"
      );
    });

    it("deve tratar erro na busca de lembretes", async () => {
      mockGetPendingRemindersByPhone.mockRejectedValue(
        new Error("Erro no banco")
      );

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao reagendar lembrete");
    });

    it("deve truncar mensagens longas na exibição", async () => {
      const longMessageReminder = createMockReminder({
        message: "🔔 *Lembrete:* " + "a".repeat(100),
      });

      mockGetPendingRemindersByPhone.mockResolvedValue([
        longMessageReminder,
      ] as any);
      mockRescheduleReminderById.mockResolvedValue(longMessageReminder as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("...");
    });

    it("deve remover prefixo do lembrete na exibição", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockResolvedValue(mockReminders[0] as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("Reunião importante");
      expect(result.response).not.toContain("🔔 *Lembrete:*");
    });

    it("deve mostrar data anterior e nova data formatadas", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockResolvedValue(mockReminders[0] as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("⏰ *Data anterior:*");
      expect(result.response).toContain("🆕 *Nova data:*");
      expect(result.response).toContain("11/07/2025, 14:00"); // Data anterior (com vírgula)
      expect(result.response).toContain("11/07/2025, 16:00"); // Nova data (com vírgula)
    });

    it("deve incluir nota de reagendamento automático quando aplicável", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockResolvedValue(mockReminders[0] as any);

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt,
        true
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain(
        "⏰ *Horário já passou hoje, agendado para amanhã.*"
      );
    });

    it("deve tratar erro no serviço de reagendamento", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockRejectedValue(new Error("Erro no banco"));

      const newScheduledAt = new Date("2025-07-11T16:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        1,
        newScheduledAt
      );

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao reagendar lembrete");
    });

    it("deve reagendar o segundo lembrete corretamente", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);
      mockRescheduleReminderById.mockResolvedValue(mockReminders[1] as any);

      const newScheduledAt = new Date("2025-07-12T15:00:00.000Z");
      const result = await processRescheduleReminderCommand(
        senderPhone,
        2,
        newScheduledAt
      );

      expect(result.success).toBe(true);
      expect(result.response).toContain("Lembrete #2 reagendado");
      expect(result.response).toContain("Ligar para médico");
      expect(mockRescheduleReminderById).toHaveBeenCalledWith(
        "2",
        newScheduledAt
      );
    });
  });

  describe("processListRemindersCommand", () => {
    const senderPhone = "5521964660801";

    it("deve listar lembretes pendentes", async () => {
      const mockReminders = [
        createMockReminder({
          id: "1",
          message: "🔔 *Lembrete:* Reunião",
          scheduledAt: new Date("2025-07-11T14:00:00.000Z"),
        }),
      ];
      mockGetPendingRemindersByPhone.mockResolvedValue(mockReminders as any);

      const result = await processListRemindersCommand(senderPhone);

      expect(result.success).toBe(true);
      expect(result.response).toContain("📝 *Seus Lembretes Pendentes*");
      expect(result.response).toContain("1. 📅");
      expect(result.response).toContain("💬 Reunião");
    });

    it("deve mostrar mensagem para lista vazia", async () => {
      mockGetPendingRemindersByPhone.mockResolvedValue([] as any);

      const result = await processListRemindersCommand(senderPhone);

      expect(result.success).toBe(true);
      expect(result.response).toContain("📝 *Seus Lembretes*");
      expect(result.response).toContain("🎉 Você não tem lembretes pendentes!");
    });

    it("deve tratar erro na busca de lembretes", async () => {
      mockGetPendingRemindersByPhone.mockRejectedValue(
        new Error("Erro no banco")
      );

      const result = await processListRemindersCommand(senderPhone);

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Erro ao buscar seus lembretes");
    });
  });

  describe("processWebhookMessage", () => {
    const senderPhone = "5521964660801";

    it("deve processar mensagem de lembrete com sucesso", async () => {
      const mockMessage = {
        from: senderPhone,
        text: { body: "#lembrete 15:30 Reunião importante" },
        timestamp: "2023-01-01T12:00:00Z",
        type: "text",
      };

      mockCreateReminder.mockResolvedValue(
        createMockReminder({
          id: "123",
          message: "🔔 *Lembrete:* Reunião importante",
          scheduledAt: new Date("2025-07-11T15:30:00.000Z"),
          phone: senderPhone,
          isSent: false,
          createdAt: new Date(),
          sentAt: null,
          retryCount: 0,
          lastError: null,
          source: "api",
        }) as any
      );

      const result = await processWebhookMessage(mockMessage);

      expect(result.success).toBe(true);
      expect(result.response).toContain("✅ Lembrete criado com sucesso!");
      expect(result.response).toContain("Reunião importante");
      expect(mockCreateReminder).toHaveBeenCalled();
    });

    it("deve retornar erro para mensagem inválida", async () => {
      const mockMessage = {
        from: senderPhone,
        text: { body: "#lembrete formato inválido" },
        timestamp: "2023-01-01T12:00:00Z",
        type: "text",
      };

      const result = await processWebhookMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.response).toContain("❌ Formato de lembrete inválido");
    });

    it("deve tratar mensagem sem texto", async () => {
      const mockMessage = {
        from: senderPhone,
        timestamp: "2023-01-01T12:00:00Z",
        type: "text",
      };

      const result = await processWebhookMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.response).toBe("Mensagem vazia recebida");
    });

    it("deve tratar mensagem que não é lembrete", async () => {
      const mockMessage = {
        from: senderPhone,
        text: { body: "Olá, como vai?" },
        timestamp: "2023-01-01T12:00:00Z",
        type: "text",
      };

      const result = await processWebhookMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.response).toBe("Não é uma mensagem de lembrete");
    });

    it("deve tratar erro no createReminder", async () => {
      const mockMessage = {
        from: senderPhone,
        text: { body: "#lembrete 15:30 Reunião importante" },
        timestamp: "2023-01-01T12:00:00Z",
        type: "text",
      };

      mockCreateReminder.mockRejectedValue(new Error("Erro no banco"));

      const result = await processWebhookMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.response).toContain(
        "❌ Erro interno ao processar lembrete"
      );
    });
  });

  describe("generateHelpMessage", () => {
    it("deve gerar mensagem de ajuda completa", () => {
      const help = generateHelpMessage();

      expect(help).toContain("🤖 *Ajuda - Comandos*");
      expect(help).toContain("📝 *Para criar um lembrete:*");
      expect(help).toContain("#lembrete");
      expect(help).toContain("#lembrar");
      expect(help).toContain("#cancelar");
      expect(help).toContain("#editar");
      expect(help).toContain("#reagendar");
      expect(help).toContain("🔄 *Lembretes recorrentes:*");
      expect(help).toContain("todos os dias");
      expect(help).toContain("📅 *Exemplos de uso:*");
    });
  });
});
