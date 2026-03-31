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

// Update conversation (status, summary, or contact fields)
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, summary } = req.body;
    const validStatuses = ['New', 'Leave it', 'To Follow Up', 'Converted', 'Other'];

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const updates: Record<string, any> = {};
    if (status) updates.status = status;
    if (summary !== undefined) updates.summary = summary;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.flagged !== undefined) updates.flagged = req.body.flagged;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // If contact fields are being updated
    if (req.body.contact_display_name !== undefined || req.body.contact_username !== undefined) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', req.params.id)
        .single();

      if (conv?.contact_id) {
        const contactUpdates: Record<string, any> = {};
        if (req.body.contact_display_name !== undefined) contactUpdates.display_name = req.body.contact_display_name;
        if (req.body.contact_username !== undefined) contactUpdates.username = req.body.contact_username;

        await supabase
          .from('contacts')
          .update(contactUpdates)
          .eq('id', conv.contact_id);
      }
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a single conversation and its messages
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Delete messages first (foreign key constraint)
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', req.params.id);

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk delete conversations
router.post('/bulk-delete', authenticate, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' });
      return;
    }

    // Delete messages first
    await supabase
      .from('messages')
      .delete()
      .in('conversation_id', ids);

    const { error } = await supabase
      .from('conversations')
      .delete()
      .in('id', ids);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, deleted: ids.length });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
