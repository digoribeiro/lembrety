import express from "express";
import cors from "cors";
import routes from "./routes";
import { startScheduler } from "./services/schedulerService"; // Importe o scheduler

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

app.use("/api", routes);

app.listen(PORT, () => {
  console.log("================================");
  console.log("Configuração de Ambiente:");
  console.log(`TZ: ${process.env.TZ}`);
  console.log(`EVOLUTION_API_URL: ${process.env.EVOLUTION_API_URL}`);
  console.log(`WHATSAPP_INSTANCE: ${process.env.WHATSAPP_INSTANCE}`);
  console.log("================================");
  startScheduler(); // Inicia o serviço de agendamento
});
