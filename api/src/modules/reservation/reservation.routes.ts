import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import { createReservationSchema } from "./reservation.types";
import {
  createReservationController,
  listReservationsController,
  getReservationController,
  getExpiredReservationsController,
} from "./reservation.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createReservationSchema, createReservationController),
);

router.get("/", listReservationsController);

router.get("/expired", getExpiredReservationsController);

router.get("/:id", getReservationController);

export default router;
