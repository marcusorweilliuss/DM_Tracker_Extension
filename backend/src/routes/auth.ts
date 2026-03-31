import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { supabase } from '../utils/supabase';
import { authenticate } from '../middleware/auth';
import { AuthRequest, RegisterRequest } from '../types';

const router = Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ email, password_hash, name })
      .select('id, email, name')
      .single();

    if (error) {
      const msg = error.code === '23505' ? 'Email already registered' : error.message;
      res.status(400).json({ error: msg });
      return;
    }

    const token = jwt.sign({ userId: data.id, email: data.email }, process.env.JWT_SECRET!, {
      expiresIn: '30d',
    });

    res.json({ token, user: data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request<{}, {}, AuthRequest>, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, {
      expiresIn: '30d',
    });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password — sends reset email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email, frontendUrl } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (!user) {
      // Don't reveal if email exists or not
      res.json({ message: 'If that email is registered, a reset link has been sent.' });
      return;
    }

    // Generate a reset token (JWT with short expiry)
    const resetToken = jwt.sign({ userId: user.id, email: user.email, purpose: 'reset' }, process.env.JWT_SECRET!, {
      expiresIn: '1h',
    });

    const baseUrl = frontendUrl || 'https://dm-tracker-dashboard.onrender.com';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    if (!resend) {
      console.log('[Auth] No RESEND_API_KEY set. Reset link:', resetLink);
      res.json({ message: 'If that email is registered, a reset link has been sent.' });
      return;
    }

    await resend.emails.send({
      from: 'DM Tracker <onboarding@resend.dev>',
      to: user.email,
      subject: 'Reset your DM Tracker password',
      html: `
        <h2>Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#d6336c;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a></p>
        <p style="color:#999;font-size:12px;">If you didn't request this, you can ignore this email.</p>
      `,
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password — using token from email
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      return;
    }

    if (decoded.purpose !== 'reset') {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', decoded.userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password — when logged in
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const userId = (req as any).userId;
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
