import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import routes from "./routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
