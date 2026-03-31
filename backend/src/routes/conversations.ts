import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { supabase } from '../utils/supabase';

const router = Router();

// List all conversations with contact info
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, logged_by, from, to } = req.query;

    let query = supabase
      .from('conversations')
      .select('*, contacts(*), users!conversations_logged_by_fkey(id, name, email)')
      .order('last_message_at', { ascending: false });

    if (status) query = query.eq('status', status as string);
    if (logged_by) query = query.eq('logged_by', logged_by as string);
    if (from) query = query.gte('last_message_at', from as string);
    if (to) query = query.lte('last_message_at', to as string);

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single conversation with messages
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('*, contacts(*), users!conversations_logged_by_fkey(id, name, email)')
      .eq('id', req.params.id)
      .single();

    if (convErr || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id)
      .order('sent_at', { ascending: true });

    if (msgErr) {
      res.status(500).json({ error: msgErr.message });
      return;
    }

    res.json({ ...conversation, messages });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update conversation status
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['New', 'Responded', 'Following Up', 'Converted', 'Not Interested'];

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
