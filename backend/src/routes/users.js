import { Router } from 'express';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createUser, updateUser } from '../services/userService.js';
import { publicUser } from '../middleware/auth.js';
import { listLimit } from '../utils/listLimit.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ name: 1 }).limit(listLimit(_req.query.limit, 100));
    res.json(users.map(publicUser));
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(publicUser(user));
  }),
);

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id, req.body);
    res.json(publicUser(user));
  }),
);
