import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const evolutionConfig = {
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    "Content-Type": "application/json",
    apikey: process.env.EVOLUTION_API_KEY,
  },
};

const api = axios.create(evolutionConfig);

interface SendMessageParams {
  phone: string;
  message: string;
}

export const sendWhatsAppMessage = async ({
  phone,
  message,
}: SendMessageParams) => {
  try {
    const endpoint = `/message/sendText/${process.env.WHATSAPP_INSTANCE}`;

    // Log para depuração
    console.log("Enviando para:", endpoint);
    console.log("Número:", phone);
    console.log("Mensagem:", message);

    const payload = {
      number: phone,
      text: message,
    };

    const response = await api.post(endpoint, payload);
    return response.data;
  } catch (error: any) {
    // Log detalhado do erro
    console.error("Erro completo:", error);
    console.error("Resposta da API:", error.response?.data);
    console.error("Resposta da API:", error.response?.data.response.message);

    throw new Error(
      error.response?.data?.response?.message || "Erro desconhecido"
    );
  }
};

export const verifyInstanceStatus = async () => {
  try {
    const response = await api.get(
      `/instance/connectionState/${process.env.WHATSAPP_INSTANCE}`
    );
    return response.data;
  } catch (error: any) {
    console.error(
      "Erro ao verificar status da instância:",
      error.response?.data || error.message
    );
    throw new Error("Falha ao conectar com a Evolution API");
  }
};

export const checkInstanceStatus = async () => {
  try {
    const response = await api.get(
      `/instance/connectionState/${process.env.WHATSAPP_INSTANCE}`
    );
    return response.data;
  } catch (error: any) {
    console.error(
      "Erro ao verificar status da instância:",
      error.response?.data || error.message
    );
    throw new Error("Falha ao verificar status da instância");
  }
};
