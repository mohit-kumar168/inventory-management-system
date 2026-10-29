import type { Request, Response } from "express";
import AsyncHandler from "../../../shared/asyncHandler";
import ApiResponse from "../../../shared/apiResponse";
import ApiError from "../../../shared/apiError";
import { AddressService } from "./address.service";
import { createAddressSchema, updateAddressSchema } from "./address.types";

function getParam(value: string | string[] | undefined): string {
  const result = Array.isArray(value) ? value[0] : value;

  if (!result) {
    throw new ApiError(400, "Required route parameter is missing");
  }

  return result;
}

export const createAddressController = AsyncHandler(
  async (req: Request, res: Response) => {
    const customerId = getParam(req.params.customerId);
    const parsed = createAddressSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid address data");
    }

    const address = await AddressService.create(customerId, parsed.data);

    res
      .status(201)
      .json(new ApiResponse("Customer address created successfully", address));
  },
);

export const listAddressesController = AsyncHandler(
  async (req: Request, res: Response) => {
    const customerId = getParam(req.params.customerId);
    const addresses = await AddressService.list(customerId);

    res
      .status(200)
      .json(new ApiResponse("Customer addresses retrieved successfully", addresses));
  },
);

export const getAddressController = AsyncHandler(
  async (req: Request, res: Response) => {
    const customerId = getParam(req.params.customerId);
    const addressId = getParam(req.params.addressId);

    const address = await AddressService.getById(customerId, addressId);

    res
      .status(200)
      .json(new ApiResponse("Customer address retrieved successfully", address));
  },
);

export const updateAddressController = AsyncHandler(
  async (req: Request, res: Response) => {
    const customerId = getParam(req.params.customerId);
    const addressId = getParam(req.params.addressId);
    const parsed = updateAddressSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid address data");
    }

    const address = await AddressService.update(
      customerId,
      addressId,
      parsed.data,
    );

    res
      .status(200)
      .json(new ApiResponse("Customer address updated successfully", address));
  },
);

export const deleteAddressController = AsyncHandler(
  async (req: Request, res: Response) => {
    const customerId = getParam(req.params.customerId);
    const addressId = getParam(req.params.addressId);

    const address = await AddressService.delete(customerId, addressId);

    res
      .status(200)
      .json(new ApiResponse("Customer address deleted successfully", address));
  },
);

