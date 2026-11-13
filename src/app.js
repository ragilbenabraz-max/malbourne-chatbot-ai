const express = require("express");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const supabase = require("./config/supabase");
const dashboardRoutes = require("./routes/dashboard.routes");
const { getKnowledge } = require("./services/knowledge.service");
const { getAiStatus, toggleAiStatus } = require("./services/session.service");
const {
  generateReply,
  generateConversationSummary,
} = require("./services/ai.service");
const {
  getConversationHistory,
  saveMessage,
} = require("./services/conversation.service");
const {
  getSummaryData,
  saveSummary,
  getUnsummarizedMessages,
} = require("./services/summary.service");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api/dashboard", dashboardRoutes);

// Helper untuk menjalankan background summary secara aman
function triggerBackgroundSummary(customerId, summaryData, currentSummary) {
  setTimeout(async () => {
    try {
      const unsummarizedMessages = await getUnsummarizedMessages(
        customerId,
        summaryData.lastSummarizedMessageId,
        999999999,
      );

      if (unsummarizedMessages.length >= 10) {
        console.log(
          `[BACKGROUND] Generating conversation summary for ${customerId}...`,
        );

        const updatedSummary = await generateConversationSummary(
          unsummarizedMessages,
          currentSummary,
        );

        const lastMessageId =
          unsummarizedMessages[unsummarizedMessages.length - 1].id;
        await saveSummary(customerId, updatedSummary, lastMessageId);

        console.log(
          `[BACKGROUND] Conversation summary updated for ${customerId}!`,
        );
      }
    } catch (summaryError) {
      console.error(
        `[BACKGROUND ERROR] Failed to generate summary for ${customerId}:`,
        summaryError.message,
      );
    }
  }, 0);
}

// Route utama
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Malbourne Coffee AI Backend is running!",
  });
});

// Tes koneksi Supabase
app.get("/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("connection_test")
      .select("*")
      .limit(1);

    if (error) throw error;

    res.json({
      status: "success",
      message: "Supabase connected successfully!",
      data,
    });
  } catch (error) {
    console.error("Supabase error:", error.message);
    res.status(500).json({
      status: "error",
      message: "Supabase connection failed",
    });
  }
});

// Tes pengambilan data Knowledge Base
app.get("/test-knowledge", async (req, res) => {
  try {
    const knowledge = await getKnowledge();
    res.json({
      status: "success",
      total: knowledge.length,
      data: knowledge,
    });
  } catch (error) {
    console.error("Knowledge Base Error:", error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve knowledge",
    });
  }
});

// Tes Groq/Qwen AI + Conversation Memory + Background Summary
app.post("/test-ai", async (req, res) => {
  try {
    const { message, customerId } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        status: "error",
        message: "A valid message is required",
      });
    }

    const customer = customerId || "test-customer-001";

    const history = await getConversationHistory(customer);
    const summaryData = await getSummaryData(customer);
    const summary = summaryData.summary;

    const { reply } = await generateReply(message.trim(), history, summary);

    await saveMessage(customer, "user", message.trim());
    await saveMessage(customer, "assistant", reply);

    res.json({
      status: "success",
      customerId: customer,
      historyUsed: history.length,
      summaryUsed: summary.length > 0,
      reply,
    });

    triggerBackgroundSummary(customer, summaryData, summary);
  } catch (error) {
    console.error("AI Test Error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate AI response",
    });
  }
});

// VERIFIKASI WEBHOOK DARI META
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN =
    process.env.WEBHOOK_VERIFY_TOKEN || "malbourne_verify_2026";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// MENERIMA PESAN WA DAN MEMBALASNYA
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message || message.type !== "text") return;

    const customerPhone = message.from;
    const userText = message.text.body;

    const isPaused = await getAiStatus(customerPhone);
    await saveMessage(customerPhone, "user", userText);

    if (isPaused) {
      console.log(
        `[INFO] AI dijeda untuk ${customerPhone}. Menunggu balasan admin.`,
      );
      return;
    }

    const history = await getConversationHistory(customerPhone);
    const summaryData = await getSummaryData(customerPhone);
    const summary = summaryData.summary;

    const { reply, needsHandover } = await generateReply(
      userText,
      history,
      summaryData.summary,
    );

    if (needsHandover) {
      await toggleAiStatus(customerPhone, true);
      console.log(`[HANDOVER] AI menyerahkan chat ${customerPhone} ke admin.`);
    }

    await saveMessage(customerPhone, "assistant", reply);

    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: customerPhone,
        type: "text",
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    triggerBackgroundSummary(customerPhone, summaryData, summary);
  } catch (error) {
    console.error("Webhook Error:", error.response?.data || error.message);
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
