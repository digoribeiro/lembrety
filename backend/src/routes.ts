import { Router } from "express";

import { scheduleReminder } from "./controllers/reminderController";
import { sendWhatsAppMessage } from "./services/evolutionService";

// Importação direta

const router = Router();

router.post("/reminder", scheduleReminder);

// Nova rota para testar envio de mensagem
router.post("/test-message", async (req, res) => {
  const { phone, message } = req.body;

  try {
    const result = await sendWhatsAppMessage({ phone, message });
    res.json({
      success: true,
      messageId: result.key.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Falha ao enviar mensagem",
    });
  }
});

export default router;
