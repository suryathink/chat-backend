import { Router } from "express";
import chatRoutes from "./chat.routes";
import userRoutes from "./user.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
router.use("/chat", chatRoutes);
router.use("/user", userRoutes);

export default router;
