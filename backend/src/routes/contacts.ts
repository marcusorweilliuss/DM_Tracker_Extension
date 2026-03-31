import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { supabase } from '../utils/supabase';

const router = Router();

// List all contacts
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, conversations(id, status, summary, last_message_at, logged_by)')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single contact with conversations
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, conversations(*, messages(*))')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
