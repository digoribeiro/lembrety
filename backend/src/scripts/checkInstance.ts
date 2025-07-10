// src/scripts/checkInstance.ts
import { checkInstanceStatus } from "../services/evolutionService";

async function testConnection() {
  try {
    const status = await checkInstanceStatus();
    console.log(status);
    console.log("📱 Status da Instância:", status);
    console.log("Nome:", status.instance.instanceName);
    console.log("Estado:", status.instance.state);
    console.log("Conectado?", status.instance.state === "open" ? "✅ Sim" : "❌ Não");
  } catch (error) {
    console.error("Falha na conexão:", error);
  }
}

testConnection();
