
import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { AuthService } from "./auth.service";
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "./auth.types";
import ApiResponse from "../../shared/apiResponse";
import AsyncHandler from "../../shared/asyncHandler";
import ApiError from "../../shared/apiError";
import { cookieOptions } from "../../config/cookie";

type BodyRequest<T> = Request<ParamsDictionary, unknown, T>;

function setCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie("refreshToken", refreshToken, cookieOptions);
  res.cookie("accessToken", accessToken, cookieOptions);
}

function clearCookies(res: Response) {
  res.clearCookie("refreshToken", cookieOptions);
  res.clearCookie("accessToken", cookieOptions);
}

export const registerController = AsyncHandler(
  async (req: BodyRequest<RegisterInput>, res: Response) => {
    const result = await AuthService.register(req.body);
    const { accessToken, refreshToken, ...responseData } = result;

    setCookies(res, accessToken, refreshToken);

    res.status(201).json(
      new ApiResponse("Account registered successfully", responseData),
    );
  },
);

export const loginController = AsyncHandler(
  async (req: BodyRequest<LoginInput>, res: Response) => {
    const result = await AuthService.login(req.body);
    const { accessToken, refreshToken, ...responseData } = result;

    setCookies(res, accessToken, refreshToken);

    res.status(200).json(
      new ApiResponse("Login successful", responseData),
    );
  },
);

export const logoutController = AsyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    await AuthService.logout(
      typeof refreshToken === "string" ? refreshToken : undefined,
    );

    clearCookies(res);

    res.status(200).json(
      new ApiResponse("Logged out successfully", null),
    );
  },
);

export const refreshController = AsyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    if (typeof refreshToken !== "string" || !refreshToken) {
      throw new ApiError(401, "Refresh token cookie is missing");
    }

    const result = await AuthService.refresh(refreshToken);
    const { accessToken, refreshToken: newRefreshToken, ...responseData } =
      result;

    setCookies(res, accessToken, newRefreshToken);

    res.status(200).json(
      new ApiResponse("Tokens refreshed successfully", responseData),
    );
  },
);

export const updateProfileController = AsyncHandler(
  async (
    req: Request<ParamsDictionary, unknown, UpdateProfileInput>,
    res: Response,
  ) => {
    const user = await AuthService.updateProfile(
      req.user!.id,
      req.body,
    );

    res.status(200).json(
      new ApiResponse("Profile updated successfully", user),
    );
  },
);

