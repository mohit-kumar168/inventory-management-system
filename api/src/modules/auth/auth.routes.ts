import { Router } from "express";

import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  updateProfileController,
} from "./auth.controller";

import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from "./auth.types";

import { validateBody } from "../../middlewares/validate.middleware";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema, registerController),
);

router.post(
  "/login",
  validateBody(loginSchema, loginController),
);

router.post("/refresh", refreshController);
router.post("/logout", logoutController);

router.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

router.patch(
  "/me",
  authenticate,
  validateBody(updateProfileSchema, updateProfileController),
);

export default router;
