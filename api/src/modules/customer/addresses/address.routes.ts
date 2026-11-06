import { Router } from "express";
import {
  createAddressController,
  listAddressesController,
  getAddressController,
  updateAddressController,
  deleteAddressController,
} from "./address.controller";

const router = Router({ mergeParams: true });

router.post("/", createAddressController);
router.get("/", listAddressesController);
router.get("/:addressId", getAddressController);
router.patch("/:addressId", updateAddressController);
router.delete("/:addressId", deleteAddressController);

export default router;

