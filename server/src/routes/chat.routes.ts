import { Router } from "express";
import {
  createChat,
  deleteMessage,
  editMessage,
  getMessages,
  markMessageRead,
  sendMessage,
  updateLastSeen,
} from "../controllers/chat.controller";
import { asyncHandler } from "../helpers/asyncHandler";

const router = Router();

router.post("/create", asyncHandler(createChat));
router.post("/:chatId/message/send", asyncHandler(sendMessage));
router.get("/:chatId/messages", asyncHandler(getMessages));
router.post("/:chatId/message/:messageId/read", asyncHandler(markMessageRead));
router.post("/:chatId/message/:messageId/edit", asyncHandler(editMessage));
router.post("/:chatId/message/:messageId/delete", asyncHandler(deleteMessage));
router.post("/:chatId/lastseen", asyncHandler(updateLastSeen));

export default router;
