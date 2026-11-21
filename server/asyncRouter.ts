import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AnyHandler = (req: any, res: Response, next: NextFunction) => unknown;

const wrap =
  (fn: AnyHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Express 4 Router whose async handlers forward rejections to the error middleware. */
export function asyncRouter(): Router {
  const router = Router();
  for (const m of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    const original = router[m].bind(router) as (path: string, ...h: RequestHandler[]) => Router;
    (router as any)[m] = (path: string, ...handlers: AnyHandler[]) => original(path, ...handlers.map(wrap));
  }
  return router;
}
