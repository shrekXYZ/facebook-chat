const axios = require("axios");
const fs = require("fs");

const templates = {
  SALUDO_OPCIONES: "saludo_opciones",
  MARCAS_CERVEZAS: "marcas_cervezas",
  INFORMACION_PRODUCTO: "informacion_producto",
  CERVEZAS_O_INICIO: "cervezas_o_inicio",
  PROMOCIONES: "promociones",
  HORARIOS: "horarios",
  ERROR_GENERICO: "error_generico",
};

// Utilidad para limpiar texto y asegurar longitud
function sanitize(text) {
  const cleaned = text.replace(/[\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return cleaned.slice(0, 1024);
}

// Token de acceso generado en la consola de Meta
const accessToken = "EAAkkLSTJgmcBPFmRRUEGF6wro3AtLiFmPxsVQKPLdO5d2FJaLhuigRJGl8HpDUFweaaZBrUFPDZAVmZADKoCT10ANEy2n6z7jRF2tZCZBZC66CNg6EDJazQE7xAomczi4l14ZBY8ZAlu60GUKmV5zPAvJKpt3mZCfz0zPZCnwKVoa6ZBJ5eHFMUQGymJxMlc8FZBs7ZBBTxBoiQIyXG4qvdraZBbEkUjzSZA88CIuISBEPvxi1fWXrtkGPZAxpnKHucHT8zorEMZD";
const phoneNumberId = "655831640955634";

// Función para limpiar y validar el número
function procesarNumero(to) {
  if (!to) throw new Error("Número de destinatario no válido");
  return to.startsWith("521") ? to.replace(/^521/, "52") : to;
}
 
// Función genérica para construir y enviar payloads
async function enviarPayload(to, templateName, components = []) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  to = procesarNumero(to);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_MX" },
      components,
    },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, payload, { headers });
    logExitoso(payload, response.data);
  } catch (error) {
    logError(payload, error);
  }
}

// Funciones específicas
async function enviarPlantillaWhatsApp(to, templateName, params = {}) {
  let components = [];
  // Si params es un array, es para plantillas con solo body
  if (Array.isArray(params)) {
    if (params.length > 0) {
      components.push({
        type: "body",
        parameters: params.map(text => ({ type: "text", text: String(text) })),
      });
    }
  } else if (typeof params === "object" && (params.header || params.body)) {
    if (params.header) {
      components.push({
        type: "header",
        parameters: params.header.map(text => ({ type: "text", text: String(text) })),
      });
    }
    if (params.body) {
      components.push({
        type: "body",
        parameters: params.body.map(text => ({ type: "text", text: String(text) })),
      });
    }
  }
  await enviarPayload(to, templateName, components);
}

async function enviarPlantillaErrorGenerico(to, errorMessage) {
  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: errorMessage }],
    },
  ];
  await enviarPayload(to, templates.ERROR_GENERICO, components);
}

async function enviarMensajeTexto(to, text) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: procesarNumero(to),
    type: "text",
    text: { body: text },
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, payload, { headers });
    logExitoso(payload, response.data);
  } catch (error) {
    logError(payload, error);
  }
}

// Funciones auxiliares para logging
function logExitoso(payload, responseData) {
  const logMessage = `${new Date().toISOString()} - Enviado: ${JSON.stringify(payload)}\nRespuesta: ${JSON.stringify(responseData)}\n`;
  fs.appendFileSync("template_log.txt", logMessage);
  console.log("Plantilla enviada exitosamente:", responseData);
}

function logError(payload, error) {
  const errorData = error.response?.data || error.message;
  const logMessage = `${new Date().toISOString()} - Error enviando: ${JSON.stringify(payload)}\nError: ${JSON.stringify(errorData)}\n`;
  fs.appendFileSync("template_log.txt", logMessage);
  console.error("Error enviando plantilla:", errorData);
}

module.exports = {
  templates,
  enviarPlantillaWhatsApp,
  enviarPlantillaErrorGenerico,
  enviarMensajeTexto,
};