import type { Request, Response, RequestHandler, NextFunction } from "express";

const AsyncHandler = (
  fn: RequestHandler
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default AsyncHandler;
