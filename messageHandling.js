const fs = require("fs");
const { templates, enviarPlantillaWhatsApp } = require("./whatsappTemplates");
const db = require("./db");

// Alias
const sendTemplateMessage = enviarPlantillaWhatsApp;

// Mapa: messageId de Meta -> { to }
const followUps = new Map();

// --- Consultas BD ---
async function getCervezas() {
  const [rows] = await db.query(
    "SELECT id, nombre FROM cervezas WHERE activo=1 ORDER BY nombre"
  );
  return rows;
}

async function getPresentaciones(cervezaId) {
  const [rows] = await db.query(
    "SELECT DISTINCT volumen, precio FROM presentaciones WHERE cerveza_id=? ORDER BY id",
    [cervezaId]
  );
  return rows;
}

async function getPromociones() {
  const [rows] = await db.query("SELECT descripcion FROM promociones WHERE activa=1");
  return rows.map((r) => r.descripcion);
}

async function getHorarios() {
  const [rows] = await db.query("SELECT dia, horario FROM horarios");
  return rows.map((r) => `${r.dia}: ${r.horario}`);
}

// --- Mensajes entrantes ---
async function handleIncomingMessage(payload) {
  fs.appendFileSync(
    "debug_post_log.txt",
    `${new Date().toISOString()} - POST: ${JSON.stringify(payload)}\n`
  );

  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const msg = change?.value?.messages?.[0];
  if (!msg) return; // puede ser un status, no un mensaje

  const from = msg.from;
  const type = msg.type;
  const body = msg.text?.body?.toLowerCase() || "";

  // 1) Saludo
  const saludos = [
    "hola","hi","buen día","buenos días","hello","qué tal",
    "buenas tardes","buenas noches","saludos","hey","cómo estás","como estas","qué onda","que onda"
  ];
  if (type === "text" && saludos.some((s) => body.includes(s))) {
    await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
    return;
  }

  // 2) Botones
  if (type === "button" && msg.button?.payload) {
    const p = msg.button.payload.toLowerCase();

    if (p.includes("cervezas")) {
      const cervezas = await getCervezas();
      const lista = cervezas.map((c,i)=>`${i+1} - ${c.nombre}`).join(" | ");
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
    if (p.includes("promociones")) {
      const promos = await getPromociones();
      await sendTemplateMessage(from, templates.PROMOCIONES, [promos.join(" | ")]);
      return;
    }
    if (p.includes("horarios")) {
      const horarios = await getHorarios();
      await sendTemplateMessage(from, templates.HORARIOS, [horarios.join(" | ")]);
      return;
    }
    if (p.includes("ver otra marca")) {
      const cervezas = await getCervezas();
      const lista = cervezas.map((c,i)=>`${i+1} - ${c.nombre}`).join(" | ");
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
    if (p.includes("volver al inicio") || p.includes("volver al menú") || p.includes("volver al menu")) {
      await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
      return;
    }
  }

  // 3) Selección por número
  if (type === "text" && /^\d+$/.test(body.trim())) {
    const cervezas = await getCervezas();
    const idx = parseInt(body.trim(), 10) - 1;

    if (idx >= 0 && idx < cervezas.length) {
      const cerveza = cervezas[idx];
      const presentaciones = await getPresentaciones(cerveza.id);

      const precios = presentaciones.length
        ? presentaciones.map(p => `${p.volumen} $${Number(p.precio).toFixed(2)}`).join(" | ")
        : "Sin presentaciones disponibles";

      // Enviar tarjeta de información y registrar follow-up por status
      const resp = await sendTemplateMessage(from, templates.INFORMACION_PRODUCTO, {
        header: [cerveza.nombre],          // HEADER {{1}}
        body:   [cerveza.nombre, precios], // BODY   {{1}}, {{2}}
      });

      const sentId = resp?.messages?.[0]?.id;
      if (sentId) followUps.set(sentId, { to: from });
      return;
    } else {
      await sendTemplateMessage(from, templates.ERROR_GENERICO, ["Por favor, selecciona un número válido."]);
      const lista = cervezas.map((c,i)=>`${i+1} - ${c.nombre}`).join(" | ");
      await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
      return;
    }
  }

  // 4) Navegación rápida
  if (body.includes("cerveza")) {
    const cervezas = await getCervezas();
    const lista = cervezas.map((c,i)=>`${i+1} - ${c.nombre}`).join(" | ");
    await sendTemplateMessage(from, templates.MARCAS_CERVEZAS, [lista]);
    return;
  }
  if (body.includes("promo")) {
    const promos = await getPromociones();
    await sendTemplateMessage(from, templates.PROMOCIONES, [promos.join(" | ")]);
    return;
  }
  if (body.includes("horario")) {
    const horarios = await getHorarios();
    await sendTemplateMessage(from, templates.HORARIOS, [horarios.join(" | ")]);
    return;
  }
  if (body.includes("inicio") || body.includes("menú") || body.includes("menu")) {
    await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
    return;
  }

  // 5) Fallback
  await sendTemplateMessage(from, templates.ERROR_GENERICO, ["No entendí tu mensaje. Usa el menú para navegar."]);
  await sendTemplateMessage(from, templates.SALUDO_OPCIONES);
}

// --- Status entrantes (para encadenar botones tras la tarjeta) ---
async function handleStatusUpdate(payload) {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const statuses = change?.value?.statuses;
  if (!Array.isArray(statuses)) return;

  for (const st of statuses) {
    const id = st.id;         // id del mensaje que enviamos
    const status = st.status; // "sent" | "delivered" | "read" ...
    const follow = followUps.get(id);

    if (follow && (status === "sent" || status === "delivered")) {
      followUps.delete(id);
      try {
        await sendTemplateMessage(follow.to, templates.CERVEZAS_O_INICIO);
      } catch (e) {
        console.error("Error enviando follow-up:", e?.response?.data || e.message);
      }
    }
  }
}

module.exports = {
  handleIncomingMessage,
  handleStatusUpdate,
};
