import { Router, Request, Response } from 'express';
import {
  findUserByUsername, verifyPassword, generateToken,
  getAllUsers, createUser, updateUser, changePassword
} from '../services/auth.service';
import { authenticate, requireRole } from '../middleware/auth';

export const authRoutes = Router();

// POST /api/v1/auth/login
authRoutes.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = generateToken({ userId: user.id, username: user.username, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    },
  });
});

// GET /api/v1/auth/me
authRoutes.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/v1/auth/change-password
authRoutes.post('/change-password', authenticate, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password required' });
    return;
  }

  const user = findUserByUsername(req.user!.username);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password incorrect' });
    return;
  }

  changePassword(user.id, newPassword);
  res.json({ message: 'Password changed successfully' });
});

// GET /api/v1/auth/users (admin only)
authRoutes.get('/users', authenticate, requireRole('admin'), (_req: Request, res: Response) => {
  const users = getAllUsers();
  res.json({ users });
});

// POST /api/v1/auth/users (admin only)
authRoutes.post('/users', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const { username, display_name, password, role } = req.body;

  if (!username || !display_name || !password || !role) {
    res.status(400).json({ error: 'All fields required' });
    return;
  }

  if (!['admin', 'sales', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  try {
    const id = createUser(username, display_name, password, role);
    res.status(201).json({ id, message: 'User created' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      throw err;
    }
  }
});

// PATCH /api/v1/auth/users/:id (admin only)
authRoutes.patch('/users/:id', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { display_name, role, is_active } = req.body;

  updateUser(id, { display_name, role, is_active });
  res.json({ message: 'User updated' });
});
