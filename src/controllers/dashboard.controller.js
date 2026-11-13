const axios = require("axios");
const supabase = require("../config/supabase");
const { getConversationHistory, saveMessage } = require("../services/conversation.service");
const { getKnowledge, addKnowledge, updateKnowledge, deleteKnowledge } = require("../services/knowledge.service");
const { toggleAiStatus } = require("../services/session.service");
const { getSummaryData } = require("../services/summary.service");

// 1. Login sederhana untuk klien
async function loginAdmin(req, res) {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || "malbourne";
  const validPass = process.env.ADMIN_PASS || "kopi2026";

  if (username === validUser && password === validPass) {
    return res.json({ status: "success", token: Buffer.from(`${validUser}:${validPass}`).toString("base64") });
  }
  return res.status(401).json({ status: "error", message: "Username atau password salah!" });
}

// 2. Ambil daftar semua nomor pelanggan yang pernah chat + status AI
async function getContacts(req, res) {
  try {
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("customer_id, message, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: sessions } = await supabase.from("customers").select("phone, is_ai_paused");
    const sessionMap = {};
    (sessions || []).forEach(s => { sessionMap[s.phone] = s.is_ai_paused; });

    const contactMap = new Map();
    (messages || []).forEach(msg => {
      if (!contactMap.has(msg.customer_id)) {
        contactMap.set(msg.customer_id, {
          phone: msg.customer_id,
          lastMessage: msg.message,
          lastTime: msg.created_at,
          isAiPaused: sessionMap[msg.customer_id] || false
        });
      }
    });

    res.json({ status: "success", data: Array.from(contactMap.values()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// 3. Ambil riwayat chat + ringkasan AI pelanggan tertentu
async function getChatDetail(req, res) {
  try {
    const { phone } = req.params;
    const history = await getConversationHistory(phone);
    const summaryData = await getSummaryData(phone);
    res.json({ status: "success", history, summary: summaryData.summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// 4. Toggle AI Aktif / Manual Mode
async function setAiStatus(req, res) {
  try {
    const { phone, isPaused } = req.body;
    await toggleAiStatus(phone, isPaused);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// 5. Kirim balasan manual ke WhatsApp pelanggan
async function sendManualReply(req, res) {
  try {
    const { phone, message } = req.body;
    await saveMessage(phone, "assistant", message);

    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ status: "success" });
  } catch (error) {
    console.error("Manual Reply Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal mengirim pesan ke WhatsApp" });
  }
}

// 6. CRUD Knowledge Base
async function getDashboardKnowledge(req, res) {
  try {
    const data = await getKnowledge();
    res.json({ status: "success", data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createDashboardKnowledge(req, res) {
  try {
    const item = await addKnowledge(req.body);
    res.json({ status: "success", data: item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function editDashboardKnowledge(req, res) {
  try {
    const item = await updateKnowledge(req.params.id, req.body);
    res.json({ status: "success", data: item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function removeDashboardKnowledge(req, res) {
  try {
    await deleteKnowledge(req.params.id);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  loginAdmin,
  getContacts,
  getChatDetail,
  setAiStatus,
  sendManualReply,
  getDashboardKnowledge,
  createDashboardKnowledge,
  editDashboardKnowledge,
  removeDashboardKnowledge
};