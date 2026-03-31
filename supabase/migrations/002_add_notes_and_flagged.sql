-- Add notes and flagged columns to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;

-- Index for filtering flagged conversations
CREATE INDEX IF NOT EXISTS idx_conversations_flagged ON conversations(flagged) WHERE flagged = true;
