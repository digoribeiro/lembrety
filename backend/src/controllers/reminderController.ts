import { Request, Response } from "express";
import { toDate, format } from "date-fns-tz";

import { scheduleReminderService } from "../services/reminderService";

export const scheduleReminder = async (req: Request, res: Response) => {
  const { message, phone, scheduledAt } = req.body;

  // Converter para Date se for string
  const scheduledDate =
    typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;

  // Converter para objeto Date no fuso correto
  const scheduledAtBrazil = toDate(scheduledDate, {
    timeZone: "America/Sao_Paulo",
  });

  // Armazenar como UTC
  const scheduledAtUTC = new Date(scheduledAtBrazil.toISOString());

  try {
    const reminder = await scheduleReminderService(
      message,
      phone,
      scheduledAtUTC // Armazenar em UTC
    );

    res.status(201).json({
      ...reminder,
      scheduledAtLocal: format(scheduledAtBrazil, "yyyy-MM-dd HH:mm:ss"),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao agendar lembrete" });
  }
};
