import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { supabase } from '../utils/supabase';
import { summarizeConversation } from '../services/summarize';
import { SyncPayload } from '../types';

const router = Router();

router.post('/', authenticate, async (req: Request<{}, {}, SyncPayload>, res: Response) => {
  try {
    const { platform, conversations } = req.body;
    const userId = req.user!.userId;

    const results: { platform_conversation_id: string; status: string }[] = [];

    for (const conv of conversations) {
      // Upsert contact
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .upsert(
          {
            platform,
            platform_user_id: conv.contact.platform_user_id,
            username: conv.contact.username,
            display_name: conv.contact.display_name,
            profile_url: conv.contact.profile_url,
            has_active_listing: conv.contact.has_active_listing,
          },
          { onConflict: 'platform,platform_user_id' }
        )
        .select('id')
        .single();

      if (contactErr || !contact) {
        results.push({ platform_conversation_id: conv.platform_conversation_id, status: 'error' });
        continue;
      }

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('id, last_synced_at')
        .eq('platform', platform)
        .eq('platform_conversation_id', conv.platform_conversation_id)
        .single();

      const lastMessageAt =
        conv.messages.length > 0
          ? conv.messages.reduce((latest, m) =>
              m.sent_at > latest ? m.sent_at : latest, conv.messages[0].sent_at)
          : null;

      // Generate AI summary
      let summary: string | null = null;
      try {
        if (conv.messages.length > 0) {
          summary = await summarizeConversation(conv.messages);
        }
      } catch {
        // Continue without summary if AI call fails
      }

      let conversationId: string;

      if (existing) {
        // Update existing conversation
        const { error: updateErr } = await supabase
          .from('conversations')
          .update({
            summary,
            last_message_at: lastMessageAt,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          results.push({ platform_conversation_id: conv.platform_conversation_id, status: 'error' });
          continue;
        }
        conversationId = existing.id;
      } else {
        // Insert new conversation
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            platform,
            platform_conversation_id: conv.platform_conversation_id,
            contact_id: contact.id,
            logged_by: userId,
            summary,
            last_message_at: lastMessageAt,
            last_synced_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (convErr || !newConv) {
          results.push({ platform_conversation_id: conv.platform_conversation_id, status: 'error' });
          continue;
        }
        conversationId = newConv.id;
      }

      // Insert messages (skip duplicates by platform_message_id)
      if (conv.messages.length > 0) {
        // Get existing message IDs to avoid duplicates
        const { data: existingMsgs } = await supabase
          .from('messages')
          .select('platform_message_id')
          .eq('conversation_id', conversationId)
          .not('platform_message_id', 'is', null);

        const existingIds = new Set((existingMsgs || []).map((m) => m.platform_message_id));

        const newMessages = conv.messages
          .filter((m) => !m.platform_message_id || !existingIds.has(m.platform_message_id))
          .map((m) => ({
            conversation_id: conversationId,
            platform_message_id: m.platform_message_id,
            sender: m.sender,
            body: m.body,
            sent_at: m.sent_at,
          }));

        if (newMessages.length > 0) {
          await supabase.from('messages').insert(newMessages);
        }
      }

      results.push({
        platform_conversation_id: conv.platform_conversation_id,
        status: existing ? 'updated' : 'created',
      });
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
