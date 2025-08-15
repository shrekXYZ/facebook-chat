const fs = require("fs");
const path = require("path");
const {
  templates,
  enviarPlantillaWhatsApp,
  enviarPlantillaErrorGenerico,
  enviarMensajeTexto,
} = require("./whatsappTemplates");
const db = require("./db");

// Aliases para mayor claridad
const sendTemplateMessage = enviarPlantillaWhatsApp;
const sendTextMessage = enviarMensajeTexto;

// Funciones para obtener datos desde la base de datos
async function getCervezas() {
  const [rows] = await db.query("SELECT id, nombre FROM cervezas WHERE activo=1");
  return rows;
}

async function getPresentaciones(cervezaId) {
  const [rows] = await db.query(
    "SELECT volumen, precio FROM presentaciones WHERE cerveza_id=?",
    [cervezaId]
  );
  return rows;
}

async function getPromociones() {
  const [rows] = await db.query("SELECT descripcion FROM promociones WHERE activa=1");
  return rows.map(r => r.descripcion);
}

async function getHorarios() {
  const [rows] = await db.query("SELECT dia, horario FROM horarios");
  return rows.map(r => `${r.dia}: ${r.horario}`);
}

async function handleIncomingMessage(payload) {
  // Log de la solicitud entrante para depuración
  fs.appendFileSync(
    "debug_post_log.txt",
    `${new Date().toISOString()} - POST Request: ${JSON.stringify(payload)}\n`
  );

  // Validación básica de la estructura del payload
  const firstEntry = payload.entry?.[0];
  const firstChange = firstEntry?.changes?.[0];
  const firstMessage = firstChange?.value?.messages?.[0];

  if (!firstMessage) {
    console.log("Payload sin mensajes válidos");
    return;
  }

  const message = firstMessage;
  console.log("📩 Mensaje recibido:", message);

  if (!message.type) return;

  const from = message.from;
  const body = message.text?.body?.toLowerCase() || "";

  // 1. Saludo inicial o palabras clave
  const palabrasClaveSaludo = [
    "hola", "hi", "buen día", "buenos días", "hello", "qué tal", "buenas tardes",
    "buenas noches", "saludos", "hey", "cómo estás", "qué onda",
  ];
  if (palabrasClaveSaludo.some((palabra) => body.includes(palabra))) {
    await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
    return;
  }

  // 2. Botones del menú principal
  if (message.type === "button" && message.button?.payload) {
    const btnPayload = message.button.payload.toLowerCase();
    if (btnPayload.includes("cervezas")) {
      const cervezas = await getCervezas();
      let lista = cervezas.map((c, i) => `${i + 1} - ${c.nombre}`).join(' | ');
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
    if (btnPayload.includes("promociones")) {
      const promos = await getPromociones();
      await sendTemplateMessage(from, templates.PROMOCIONES, [promos.join(' | ')]);
      return;
    }
    if (btnPayload.includes("horarios")) {
      const horarios = await getHorarios();
      await sendTemplateMessage(from, templates.HORARIOS, [horarios.join(' | ')]);
      return;
    }
    if (btnPayload.includes("ver otra marca")) {
      const cervezas = await getCervezas();
      let lista = cervezas.map((c, i) => `${i + 1} - ${c.nombre}`).join(' | ');
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
    if (btnPayload.includes("volver al inicio") || btnPayload.includes("volver al menú")) {
      await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
      return;
    }
  }

  // 3. Selección de marca por número
  if (message.type === "text" && /^\d+$/.test(body.trim())) {
    const cervezas = await getCervezas();
    const idx = parseInt(body.trim(), 10) - 1;
    if (idx >= 0 && idx < cervezas.length) {
      const cerveza = cervezas[idx];
      const presentaciones = await getPresentaciones(cerveza.id);
      let nombre = cerveza.nombre;
      let precios = presentaciones.map(p => `${p.volumen} $${p.precio}`).join(' | ');
      console.log("Enviando a plantilla:", [nombre, precios]); // <-- Depuración
      await sendTemplateMessage(from, templates.INFORMACION_PRODUCTO, [nombre, precios]);
      await sendTemplateMessage(from, templates.CERVEZAS_O_INICIO);
      return;
    } else {
      await sendTemplateMessage(from, templates.ERROR_GENERICO, ["Por favor, selecciona un número válido."]);
      const lista = cervezas.map((c, i) => `${i + 1} - ${c.nombre}`).join(' | ');
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
  }

  // 4. Palabras clave para navegación rápida
  if (body.includes("cerveza")) {
    const cervezas = await getCervezas();
    let lista = cervezas.map((c, i) => `${i + 1} - ${c.nombre}`).join(' | ');
    await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
    return;
  }
  if (body.includes("promo")) {
    const promos = await getPromociones();
    await sendTemplateMessage(from, templates.PROMOCIONES, [promos.join(' | ')]);
    return;
  }
  if (body.includes("horario")) {
    const horarios = await getHorarios();
    await sendTemplateMessage(from, templates.HORARIOS, [horarios.join(' | ')]);
    return;
  }
  if (body.includes("inicio") || body.includes("menú")) {
    await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
    return;
  }

  // 5. Mensaje libre/no reconocido
  await sendTemplateMessage(from, templates.ERROR_GENERICO, ["No entendí tu mensaje. Usa el menú para navegar."]);
  await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
}

module.exports = handleIncomingMessage;
