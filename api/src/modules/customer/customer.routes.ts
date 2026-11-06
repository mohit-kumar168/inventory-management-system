
import { Router } from "express";
import {
  createCustomerController,
  listCustomersController,
  getCustomerController,
  updateCustomerController,
  deleteCustomerController,
} from "./customer.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "./customer.types";
import addressRoutes from "./addresses/address.routes";

const router = Router();

router.use(authenticate);

router.use("/:customerId/addresses", addressRoutes);


router.post(
  "/",
  validateBody(createCustomerSchema, createCustomerController)
);

router.get("/", listCustomersController);

router.get("/:id", getCustomerController);

router.patch(
  "/:id",
  validateBody(updateCustomerSchema, updateCustomerController)
);

router.delete("/:id", deleteCustomerController);

export default router;

