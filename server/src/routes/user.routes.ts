import { Router } from "express";
import { createUser, getUserChats } from "../controllers/user.controller";
import { asyncHandler } from "../helpers/asyncHandler";

const router = Router();

router.post("/create", asyncHandler(createUser));
router.get("/:userId/chats", asyncHandler(getUserChats));

export default router;
