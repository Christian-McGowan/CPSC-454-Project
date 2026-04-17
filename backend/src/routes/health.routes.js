import { Router } from "express";
import mongoose from "mongoose";

const router = Router();
const startedAt = Date.now();

router.get("/health", (req, res) => {
  res.json({
    service: "AegisCare Portal API",
    status: mongoose.connection.readyState === 1 ? "ok" : "degraded",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    now: new Date().toISOString()
  });
});

router.get("/", (req, res) => {
  res.json({
    message: "AegisCare Portal API",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000)
  });
});

export default router;
