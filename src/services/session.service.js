const supabase = require("../config/supabase");

async function getAiStatus(phone) {
  const { data, error } = await supabase
    .from("customers")
    .select("is_ai_paused")
    .eq("phone", phone)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching AI status:", error.message);
  }
  return data ? data.is_ai_paused : false;
}

async function toggleAiStatus(phone, isPaused) {
  // Upsert data pelanggan (jika nomor belum ada, buat baru)
  const { data, error } = await supabase
    .from("customers")
    .upsert({ phone: phone, is_ai_paused: isPaused }, { onConflict: "phone" })
    .select();

  if (error) throw error;
  return data[0];
}

module.exports = { getAiStatus, toggleAiStatus };