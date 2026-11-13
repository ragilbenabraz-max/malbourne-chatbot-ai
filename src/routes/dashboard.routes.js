const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/dashboard.controller");

// Middleware cek token login sederhana
function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const expected = Buffer.from(`${process.env.ADMIN_USER || "malbourne"}:${process.env.ADMIN_PASS || "kopi2026"}`).toString("base64");
  if (authHeader === `Bearer ${expected}`) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

router.post("/login", ctrl.loginAdmin);
router.get("/contacts", checkAuth, ctrl.getContacts);
router.get("/chats/:phone", checkAuth, ctrl.getChatDetail);
router.post("/chats/toggle-ai", checkAuth, ctrl.setAiStatus);
router.post("/chats/send", checkAuth, ctrl.sendManualReply);

router.get("/knowledge", checkAuth, ctrl.getDashboardKnowledge);
router.post("/knowledge", checkAuth, ctrl.createDashboardKnowledge);
router.put("/knowledge/:id", checkAuth, ctrl.editDashboardKnowledge);
router.delete("/knowledge/:id", checkAuth, ctrl.removeDashboardKnowledge);

module.exports = router;