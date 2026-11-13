
const supabase = require("../config/supabase");

// Mengambil 10 pesan terakhir pelanggan
async function getConversationHistory(customerId) {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, message, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Conversation History Error:", error.message);
        throw error;
    }

    // Urutkan kembali dari pesan terlama ke terbaru
    return (data || []).reverse();
}

// Menyimpan pesan pelanggan atau AI
async function saveMessage(customerId, role, message) {
    const { error } = await supabase
        .from("chat_messages")
        .insert([
            {
                customer_id: customerId,
                role,
                message,
            },
        ]);

    if (error) {
        console.error("Save Message Error:", error.message);
        throw error;
    }
}

module.exports = {
    getConversationHistory,
    saveMessage,
};
