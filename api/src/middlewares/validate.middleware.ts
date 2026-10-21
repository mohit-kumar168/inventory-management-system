
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { z, type ZodType } from "zod";

type ValidatedRequest<TSchema extends ZodType> = Request<
  ParamsDictionary,
  unknown,
  z.output<TSchema>
>;

type ValidatedController<TSchema extends ZodType> = (
  req: ValidatedRequest<TSchema>,
  res: Response,
  next: NextFunction,
) => unknown | Promise<unknown>;

export function validateBody<TSchema extends ZodType>(
  schema: TSchema,
  controller: ValidatedController<TSchema>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const body = await schema.parseAsync(req.body);

      const validatedRequest = Object.assign(req, {
        body,
      }) as ValidatedRequest<TSchema>;

      await controller(validatedRequest, res, next);
    } catch (error) {
      next(error);
    }
  };
}

