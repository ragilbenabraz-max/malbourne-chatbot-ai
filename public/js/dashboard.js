document.addEventListener("DOMContentLoaded", () => {
  let authToken = localStorage.getItem("malbourne_token") || "";
  let activePhone = null;
  let activeAiPaused = false;

  // Elemen Utama
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
    if(loginScreen) loginScreen.classList.add("hidden");
    if(appContainer) appContainer.classList.remove("hidden");
    loadContacts();
  }

  if (authToken) showDashboard();

  // LOGIN & LOGOUT
  if(loginForm) {
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
  }

  const logoutBtn = document.getElementById("logout-btn");
  if(logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("malbourne_token");
      location.reload();
    });
  }

  // NAVIGASI TAB (INBOX & MENU)
  const navInbox = document.getElementById("nav-inbox");
  const navMenu = document.getElementById("nav-menu");
  const secInbox = document.getElementById("section-inbox");
  const secMenu = document.getElementById("section-menu");

  if(navInbox && navMenu) {
    navInbox.addEventListener("click", () => {
      navInbox.classList.add("active");
      navMenu.classList.remove("active");
      
      // Tampilkan Inbox, sembunyikan Menu
      secInbox.style.display = "flex";
      secMenu.style.display = "none";
      
      loadContacts();
    });

    navMenu.addEventListener("click", () => {
      navMenu.classList.add("active");
      navInbox.classList.remove("active");
      
      // Tampilkan Menu, sembunyikan Inbox
      secMenu.style.display = "block";
      secInbox.style.display = "none";
      
      loadKnowledgeBase();
    });
  }

  // ==========================================
  // LOGIKA CHAT & DAFTAR KONTAK (UI BARU)
  // ==========================================

  // DAFTAR KONTAK PELANGGAN
  async function loadContacts() {
    try {
      const res = await fetch("/api/dashboard/contacts", { headers: authHeaders() });
      if (res.status === 401 && logoutBtn) return logoutBtn.click();
      const result = await res.json();
      const listEl = document.getElementById("chat-list"); // ID Baru untuk Layout WA

      if (!listEl) return;

      if (!result.data || result.data.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Belum ada pesan.</div>';
        return;
      }

      listEl.innerHTML = "";
      result.data.forEach(c => {
        const div = document.createElement("div");
        div.className = `chat-item ${activePhone === c.phone ? "active-chat" : ""}`;
        div.onclick = () => selectCustomer(c.phone, c.isAiPaused);
        
        // Render UI Daftar Kontak ala WhatsApp
        div.innerHTML = `
          <div class="avatar">👤</div>
          <div class="chat-item-details">
            <div class="chat-item-header">
              <span class="phone">+${c.phone}</span>
              <span class="badge ${c.isAiPaused ? "danger" : "warning"}">
                ${c.isAiPaused ? "Butuh Admin" : "AI Aktif"}
              </span>
            </div>
            <div class="chat-item-last-msg">${c.lastMessage}</div>
          </div>
        `;
        listEl.appendChild(div);
      });
    } catch (err) {
      console.error("Gagal memuat kontak:", err);
    }
  }

  // PILIH PELANGGAN & BUKA DI HP (MOBILE SLIDE)
  async function selectCustomer(phone, isPaused) {
    activePhone = phone;
    activeAiPaused = isPaused;
    
    document.getElementById("active-phone").textContent = `+${phone}`;
    updateAiButtonUI();

    document.getElementById("chat-input").disabled = false;
    const sendBtn = document.getElementById("send-manual-btn");
    if(sendBtn) sendBtn.disabled = false;

    // Logika buka panel kanan untuk layar HP
    if(appContainer) appContainer.classList.add("chat-active");

    await refreshActiveChat();
    loadContacts(); // Refresh untuk highlight kontak yang aktif
  }

  // TOMBOL KEMBALI DI HP (Tutup panel kanan)
  const backBtn = document.getElementById("back-btn");
  if(backBtn) {
    backBtn.addEventListener("click", () => {
      if(appContainer) appContainer.classList.remove("chat-active");
    });
  }

  // MUAT RIWAYAT CHAT KE GELEMBUNG
  async function refreshActiveChat() {
    if (!activePhone) return;
    const res = await fetch(`/api/dashboard/chats/${activePhone}`, { headers: authHeaders() });
    const data = await res.json();

    const summaryBanner = document.getElementById("summary-banner");
    const summaryText = document.getElementById("summary-text");
    if (data.summary && summaryBanner && summaryText) {
      summaryBanner.style.display = "block";
      summaryText.textContent = data.summary;
    } else if (summaryBanner) {
      summaryBanner.style.display = "none";
    }

    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = "";
    
    (data.history || []).forEach(msg => {
      const div = document.createElement("div");
      // Jika role user -> masuk (kiri, putih). Jika role assistant/admin -> keluar (kanan, hijau/coklat)
      div.className = `message ${msg.role === "user" ? "msg-in" : "msg-out"}`;
      div.innerHTML = `<div class="msg-content">${msg.message}</div>`;
      chatMessages.appendChild(div);
    });
    
    // Auto-scroll ke pesan terbawah
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // TOMBOL TOGGLE MODE AI
  function updateAiButtonUI() {
    const btn = document.getElementById("toggle-ai-btn");
    const desc = document.getElementById("ai-status-desc");
    if(!btn || !desc) return;

    if (activeAiPaused) {
      btn.textContent = "Mode Balas Manual";
      btn.className = "mode-btn btn-danger";
      desc.textContent = "AI sedang diam. Silakan ketik balasan.";
    } else {
      btn.textContent = "AI Aktif";
      btn.className = "mode-btn btn-success"; // Pastikan btn-success ada di CSS (warna hijau)
      desc.textContent = "AI otomatis menjawab pertanyaan.";
    }
  }

  const toggleAiBtn = document.getElementById("toggle-ai-btn");
  if(toggleAiBtn) {
    toggleAiBtn.addEventListener("click", async () => {
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
  }

  // KIRIM PESAN MANUAL KE PELANGGAN
  const manualReplyForm = document.getElementById("manual-reply-form");
  if(manualReplyForm) {
    manualReplyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("chat-input");
      const text = input.value.trim();
      if (!text || !activePhone) return;

      input.value = "";
      
      // Otomatis jeda AI saat admin membalas manual
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
  }

  // ==========================================
  // KELOLA KNOWLEDGE BASE (TETAP SAMA)
  // ==========================================
  const kbForm = document.getElementById("kb-form");
  const kbIdInput = document.getElementById("kb-id");
  const kbCancelBtn = document.getElementById("kb-cancel-btn");

  async function loadKnowledgeBase() {
    const tbody = document.getElementById("knowledge-tbody");
    if(!tbody) return;

    const res = await fetch("/api/dashboard/knowledge", { headers: authHeaders() });
    const result = await res.json();
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

  if(kbCancelBtn) {
    kbCancelBtn.addEventListener("click", resetKbForm);
  }
  function resetKbForm() {
    if(!kbForm) return;
    kbIdInput.value = "";
    kbForm.reset();
    document.getElementById("kb-form-title").textContent = "Tambah Informasi / Menu Baru";
    document.getElementById("kb-submit-btn").textContent = "Simpan Info";
    kbCancelBtn.classList.add("hidden");
  }

  if(kbForm) {
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
  }

  // AUTO-REFRESH (Setiap 5 detik untuk chat baru)
  setInterval(() => {
    // Refresh jika sudah login dan tidak berada di tab knowledge base
    if (authToken && secInbox && secInbox.classList.contains("active")) {
      loadContacts();
      if (activePhone) refreshActiveChat();
    }
  }, 5000);
});