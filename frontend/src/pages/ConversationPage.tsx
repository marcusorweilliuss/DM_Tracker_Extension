import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Conversation, Message, ConversationStatus } from '../types';
import StatusSelect from '../components/StatusSelect';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation & { messages: Message[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getConversation(id)
      .then(setConversation)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!conversation) return;
    try {
      await api.updateConversationStatus(conversation.id, status);
      setConversation({ ...conversation, status });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-12">Loading...</p>;
  if (!conversation) return null;

  const contact = (conversation as any).contacts;

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="text-sm text-gray-400 hover:text-brand-500 mb-4 inline-block"
      >
        &larr; Back to dashboard
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {contact?.display_name || contact?.username || 'Unknown Contact'}
            </h2>
            {contact?.profile_url && (
              <a
                href={contact.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-500 hover:underline"
              >
                View profile
              </a>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              <span className="capitalize">{conversation.platform}</span>
              {contact?.has_active_listing && (
                <span className="text-green-600 text-xs font-medium">Active listing</span>
              )}
            </div>
          </div>
          <StatusSelect value={conversation.status} onChange={handleStatusChange} />
        </div>

        {conversation.summary && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1 font-medium">AI Summary</p>
            <p className="text-sm text-gray-700">{conversation.summary}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Logged by: {(conversation as any).users?.name || '—'} &middot;
          Last synced: {conversation.last_synced_at
            ? new Date(conversation.last_synced_at).toLocaleString()
            : 'Never'}
        </p>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">
          Messages ({conversation.messages?.length || 0})
        </h3>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {(!conversation.messages || conversation.messages.length === 0) ? (
            <p className="text-gray-400 text-sm text-center py-4">No messages</p>
          ) : (
            conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${
                    msg.sender === 'user'
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  <p>{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-pink-200' : 'text-gray-400'}`}>
                    {new Date(msg.sent_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
