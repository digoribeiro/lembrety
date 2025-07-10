import { Router } from "express";

import { scheduleReminder } from "./controllers/reminderController";
import {
  sendWhatsAppMessage,
  configureWebhook,
  getWebhookConfig,
} from "./services/evolutionService";
import {
  handleEvolutionWebhook,
  webhookStatus,
  testWebhook,
} from "./controllers/webhookController";

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

// Rotas do webhook
router.post("/webhook/evolution", handleEvolutionWebhook);
router.get("/webhook/status", webhookStatus);
router.post("/webhook/test", testWebhook);

// Rotas para configuração do webhook
router.post("/webhook/configure", async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: "webhookUrl é obrigatório",
      });
    }

    const result = await configureWebhook(webhookUrl);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/webhook/config", async (req, res) => {
  try {
    const config = await getWebhookConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
