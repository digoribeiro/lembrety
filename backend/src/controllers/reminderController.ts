import { Request, Response } from "express";

import { scheduleReminderService } from "../services/reminderService";

export const scheduleReminder = async (req: Request, res: Response) => {
  const { message, phone, scheduledAt } = req.body;
  // Validação adicional
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Mensagem inválida" });
  }

  try {
    const reminder = await scheduleReminderService(message, phone, scheduledAt);
    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ error: "Erro ao agendar lembrete" });
  }
};
