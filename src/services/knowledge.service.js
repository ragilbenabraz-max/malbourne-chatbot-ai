const supabase = require("../config/supabase");

async function getKnowledge(category = null, includeInactive = false) {
    let query = supabase
        .from("knowledge_base")
        .select("*")
        .order("id", { ascending: false });

    if (!includeInactive) {
        query = query.eq("is_active", true);
    }
    if (category) {
        query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function addKnowledge({ category, title, content, language = "id" }) {
    const { data, error } = await supabase
        .from("knowledge_base")
        .insert([{ category, title, content, language, is_active: true }])
        .select();

    if (error) throw error;
    return data[0];
}

async function updateKnowledge(id, { category, title, content }) {
    const { data, error } = await supabase
        .from("knowledge_base")
        .update({ category, title, content })
        .eq("id", id)
        .select();

    if (error) throw error;
    return data[0];
}

async function deleteKnowledge(id) {
    const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);

    if (error) throw error;
    return true;
}

module.exports = { getKnowledge, addKnowledge, updateKnowledge, deleteKnowledge };