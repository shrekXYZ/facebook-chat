const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { handleIncomingMessage, handleStatusUpdate } = require("./messageHandling");

router.post("/webhook", async (req, res) => {
  const payload = req.body;

  const logEntry = `${new Date().toISOString()} - WEBHOOK PAYLOAD: ${JSON.stringify(payload)}\n`;
  fs.appendFileSync(path.join(__dirname, "logs", "api_log.txt"), logEntry);

  try {
    await handleIncomingMessage(payload); // mensajes
    await handleStatusUpdate(payload);    // statuses
  } catch (err) {
    console.error("Error en handlers:", err);
  }

  res.sendStatus(200);
});

module.exports = router;
