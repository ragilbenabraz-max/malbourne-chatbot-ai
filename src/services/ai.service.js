const groq = require("../config/groq");
const { getKnowledge } = require("./knowledge.service");

const MODEL = "qwen/qwen3.8-27b";
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(messages, temperature = 0.5) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages: messages,
                temperature: temperature,
            });

            const reply = response.choices[0]?.message?.content;
            if (!reply || !reply.trim()) {
                throw new Error("Groq returned an empty response.");
            }

            return reply.trim();
        } catch (error) {
            console.error(`Groq attempt ${attempt + 1} failed:`, error.message);
            if (error.status === 429) {
                console.log("Rate limit hit, retrying...");
            } else if (![500, 502, 503, 504].includes(error.status) || attempt === MAX_RETRIES) {
                throw error;
            }
            const delay = 2000 * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
    throw new Error("Groq request failed.");
}

async function generateReply(message, history = [], summary = "") {
    const knowledge = await getKnowledge();

    const knowledgeContext = knowledge.length > 0
        ? knowledge.map((item) => `
Category: ${item.category}
Title: ${item.title}
Content: ${item.content}
Language: ${item.language || "id"}
        `).join("\n")
        : "No verified business information is currently available.";

    const systemInstruction = `
You are the official AI customer service assistant of Malbourne Coffee Co.

CORE RESPONSIBILITIES:
1. Customer service: Answer general enquiries (opening hours, locations, menus, prices, facilities).
2. Product advisor: Recommend drinks, food, and beans based on customer preferences.
3. Sales assistant: Guide customers towards purchases and taking orders.
4. Brand ambassador: Explain Malbourne's story and identity.
5. Complaint handler: Listen, apologise, and escalate to human admin.

STRICT ACCURACY & AUTO-HANDOVER RULE (CRITICAL):
- Only use verified business information provided in VERIFIED MALBOURNE KNOWLEDGE below.
- Never invent menu items, prices, promotions, current seat/table availability, custom orders, or locations.
- IF the customer asks something NOT covered in the verified knowledge (e.g., real-time table availability, custom event orders, complaints, or unknown menu details), DO NOT guess.
- Instead, reply politely in natural Bahasa Indonesia (e.g., "Mohon ditunggu sebentar ya Kak, pertanyaan ini kami sampaikan dulu ke admin Malbourne agar segera dibantu langsung 😊") AND append the exact tag [HANDOVER] at the very end of your response.

WHATSAPP FORMATTING RULES (STRICT):
- NEVER use double asterisks (**text**) or Markdown headers (###).
- For bold text in WhatsApp, ONLY use single asterisks (*text*), and use it sparingly.
- Keep responses clean, natural, and easy to read on a mobile screen.

CUSTOMER SUMMARY:
${summary || "No previous customer summary."}

VERIFIED MALBOURNE KNOWLEDGE:
${knowledgeContext}

Prioritize hospitality, accuracy, and helpful conversation in natural Bahasa Indonesia or English.
`;

    const messages = [
        { role: "system", content: systemInstruction },
        ...history.map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.message,
        })),
        { role: "user", content: message }
    ];

    const rawReply = await generateWithRetry(messages, 0.4);
    const needsHandover = rawReply.includes("[HANDOVER]");
    const cleanReply = rawReply
        .replace(/\[HANDOVER\]/g, "")
        .replace(/\*\*(.*?)\*\*/g, "*$1*")
        .trim();

    return { reply: cleanReply, needsHandover };
}

async function generateConversationSummary(history, existingSummary = "") {
    if (!history || history.length === 0) return existingSummary;

    const conversation = history.map((item) => {
        const speaker = item.role === "assistant" ? "AI" : "Customer";
        return `${speaker}: ${item.message}`;
    }).join("\n");

    const prompt = `
You are a long-term customer memory assistant for Malbourne Coffee Co.
Maintain a concise profile of the customer in Bahasa Indonesia.

PREVIOUS SUMMARY:
${existingSummary || "Belum ada ringkasan."}

NEW CONVERSATION:
${conversation}

INSTRUCTIONS:
- Preserve customer's name, favorite drinks/food, and unresolved requests.
- Use short bullet points. Never invent information. Return only the updated summary.
`;

    return await generateWithRetry([{ role: "user", content: prompt }], 0.2);
}

module.exports = {
    generateReply,
    generateConversationSummary,
};