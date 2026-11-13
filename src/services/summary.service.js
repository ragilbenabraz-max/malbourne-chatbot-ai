
const supabase = require("../config/supabase");

// Get customer summary and last summarized message ID
async function getSummaryData(customerId) {
    const { data, error } = await supabase
        .from("conversation_summaries")
        .select("summary, last_summarized_message_id")
        .eq("customer_id", customerId)
        .maybeSingle();

    if (error) {
        console.error("Get Summary Error:", error.message);
        throw error;
    }

    return {
        summary: data?.summary || "",
        lastSummarizedMessageId:
            data?.last_summarized_message_id || 0,
    };
}

// Save updated summary and message checkpoint
async function saveSummary(customerId, summary, lastMessageId) {
    const { error } = await supabase
        .from("conversation_summaries")
        .upsert(
            {
                customer_id: customerId,
                summary,
                last_summarized_message_id: lastMessageId,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "customer_id",
            }
        );

    if (error) {
        console.error("Save Summary Error:", error.message);
        throw error;
    }
}

// Get messages that have not been summarized yet
async function getUnsummarizedMessages(customerId, lastMessageId, beforeMessageId) {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, message")
        .eq("customer_id", customerId)
        .gt("id", lastMessageId)
        .lt("id", beforeMessageId)
        .order("id", { ascending: true });

    if (error) {
        console.error("Get Unsummarized Messages Error:", error.message);
        throw error;
    }

    return data || [];
}

module.exports = {
    getSummaryData,
    saveSummary,
    getUnsummarizedMessages,
};
