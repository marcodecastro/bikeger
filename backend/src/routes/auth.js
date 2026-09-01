import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../services/userService.js';
import { publicUser, requireAuth, signToken } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/loginRateLimit.js';
import { shouldSeedDemoUsers } from '../utils/security.js';

export const authRouter = Router();

authRouter.get(
  '/public-config',
  asyncHandler(async (_req, res) => {
    res.json({ demoUsers: shouldSeedDemoUsers() });
  }),
);

authRouter.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const user = await authenticate(req.body.login, req.body.password);
    res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  }),
);
