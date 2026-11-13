document.addEventListener("DOMContentLoaded", () => {
  let authToken = localStorage.getItem("malbourne_token") || "";
  let activePhone = null;
  let activeAiPaused = false;

  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    };
  }

  function showDashboard() {
    loginScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    loadContacts();
  }

  if (authToken) showDashboard();

  // LOGIN & LOGOUT
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value.trim();

    const res = await fetch("/api/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      authToken = data.token;
      localStorage.setItem("malbourne_token", authToken);
      loginError.textContent = "";
      showDashboard();
    } else {
      loginError.textContent = data.message || "Login gagal";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("malbourne_token");
    location.reload();
  });

  // NAVIGASI TAB
  const navInbox = document.getElementById("nav-inbox");
  const navMenu = document.getElementById("nav-menu");
  const secInbox = document.getElementById("section-inbox");
  const secMenu = document.getElementById("section-menu");

  navInbox.addEventListener("click", () => {
    navInbox.classList.add("active");
    navMenu.classList.remove("active");
    secInbox.classList.add("active");
    secMenu.classList.remove("active");
    loadContacts();
  });

  navMenu.addEventListener("click", () => {
    navMenu.classList.add("active");
    navInbox.classList.remove("active");
    secMenu.classList.add("active");
    secInbox.classList.remove("active");
    loadKnowledgeBase();
  });

  // DAFTAR KONTAK PELANGGAN
  async function loadContacts() {
    try {
      const res = await fetch("/api/dashboard/contacts", { headers: authHeaders() });
      if (res.status === 401) return document.getElementById("logout-btn").click();
      const result = await res.json();
      const listEl = document.getElementById("contact-list");

      if (!result.data || result.data.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Belum ada chat pelanggan masuk.</div>';
        return;
      }

      listEl.innerHTML = "";
      result.data.forEach(c => {
        const div = document.createElement("div");
        div.className = `contact-item ${activePhone === c.phone ? "active" : ""}`;
        div.innerHTML = `
          <div class="contact-top">
            <span class="contact-phone">+${c.phone}</span>
            <span class="${c.isAiPaused ? "badge-manual" : "badge-ai"}">
              ${c.isAiPaused ? "Butuh Admin" : "AI Aktif"}
            </span>
          </div>
          <div class="contact-preview">${c.lastMessage}</div>
        `;
        div.addEventListener("click", () => selectCustomer(c.phone, c.isAiPaused));
        listEl.appendChild(div);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // PILIH PELANGGAN & MUAT RIWAYAT CHAT
  async function selectCustomer(phone, isPaused) {
    activePhone = phone;
    activeAiPaused = isPaused;
    document.getElementById("active-phone-title").textContent = `+${phone}`;
    updateAiButtonUI();

    document.getElementById("manual-msg-input").disabled = false;
    document.getElementById("send-manual-btn").disabled = false;

    await refreshActiveChat();
    loadContacts();
  }

  async function refreshActiveChat() {
    if (!activePhone) return;
    const res = await fetch(`/api/dashboard/chats/${activePhone}`, { headers: authHeaders() });
    const data = await res.json();

    const summaryBanner = document.getElementById("summary-banner");
    if (data.summary) {
      summaryBanner.classList.remove("hidden");
      document.getElementById("summary-text").textContent = data.summary;
    } else {
      summaryBanner.classList.add("hidden");
    }

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    (data.history || []).forEach(msg => {
      const div = document.createElement("div");
      div.className = `msg ${msg.role === "user" ? "msg-user" : "msg-bot"}`;
      div.textContent = msg.message;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function updateAiButtonUI() {
    const btn = document.getElementById("toggle-ai-btn");
    const desc = document.getElementById("ai-status-desc");
    btn.classList.remove("hidden");
    if (activeAiPaused) {
      btn.textContent = "Mode Balas Manual (AI Dijeda)";
      btn.className = "btn btn-paused";
      desc.textContent = "AI sedang diam. Silakan ketik balasan langsung di bawah.";
    } else {
      btn.textContent = "AI Aktif (Auto-Reply)";
      btn.className = "btn btn-active";
      desc.textContent = "AI otomatis menjawab pertanyaan pelanggan.";
    }
  }

  document.getElementById("toggle-ai-btn").addEventListener("click", async () => {
    if (!activePhone) return;
    activeAiPaused = !activeAiPaused;
    await fetch("/api/dashboard/chats/toggle-ai", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ phone: activePhone, isPaused: activeAiPaused })
    });
    updateAiButtonUI();
    loadContacts();
  });

  // KIRIM BALASAN MANUAL KE WHATSAPP
  document.getElementById("manual-reply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("manual-msg-input");
    const text = input.value.trim();
    if (!text || !activePhone) return;

    input.value = "";
    // Otomatis jeda AI saat admin membalas manual agar AI tidak menimpali
    if (!activeAiPaused) {
      activeAiPaused = true;
      await fetch("/api/dashboard/chats/toggle-ai", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ phone: activePhone, isPaused: true })
      });
      updateAiButtonUI();
    }

    await fetch("/api/dashboard/chats/send", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ phone: activePhone, message: text })
    });

    await refreshActiveChat();
    loadContacts();
  });

  // KELOLA KNOWLEDGE BASE (TAMBAH / EDIT / HAPUS)
  const kbForm = document.getElementById("kb-form");
  const kbIdInput = document.getElementById("kb-id");
  const kbCancelBtn = document.getElementById("kb-cancel-btn");

  async function loadKnowledgeBase() {
    const res = await fetch("/api/dashboard/knowledge", { headers: authHeaders() });
    const result = await res.json();
    const tbody = document.getElementById("knowledge-tbody");
    tbody.innerHTML = "";

    (result.data || []).forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${item.category}</strong></td>
        <td>${item.title}</td>
        <td>${item.content}</td>
        <td>
          <button class="btn-sm btn-edit" data-id="${item.id}">Edit</button>
          <button class="btn-sm btn-del" data-id="${item.id}">Hapus</button>
        </td>
      `;
      tr.querySelector(".btn-edit").addEventListener("click", () => {
        kbIdInput.value = item.id;
        document.getElementById("kb-category").value = item.category;
        document.getElementById("kb-title").value = item.title;
        document.getElementById("kb-content").value = item.content;
        document.getElementById("kb-form-title").textContent = "Edit Informasi";
        document.getElementById("kb-submit-btn").textContent = "Perbarui Info";
        kbCancelBtn.classList.remove("hidden");
      });
      tr.querySelector(".btn-del").addEventListener("click", async () => {
        if (!confirm(`Hapus info "${item.title}"?`)) return;
        await fetch(`/api/dashboard/knowledge/${item.id}`, { method: "DELETE", headers: authHeaders() });
        loadKnowledgeBase();
      });
      tbody.appendChild(tr);
    });
  }

  kbCancelBtn.addEventListener("click", resetKbForm);
  function resetKbForm() {
    kbIdInput.value = "";
    kbForm.reset();
    document.getElementById("kb-form-title").textContent = "Tambah Informasi / Menu Baru";
    document.getElementById("kb-submit-btn").textContent = "Simpan Info";
    kbCancelBtn.classList.add("hidden");
  }

  kbForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = kbIdInput.value;
    const payload = {
      category: document.getElementById("kb-category").value,
      title: document.getElementById("kb-title").value.trim(),
      content: document.getElementById("kb-content").value.trim()
    };

    const url = id ? `/api/dashboard/knowledge/${id}` : "/api/dashboard/knowledge";
    const method = id ? "PUT" : "POST";

    await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    resetKbForm();
    loadKnowledgeBase();
  });

  // Auto-refresh kontak & chat setiap 5 detik
  setInterval(() => {
    if (authToken && secInbox.classList.contains("active")) {
      loadContacts();
      if (activePhone) refreshActiveChat();
    }
  }, 5000);
});