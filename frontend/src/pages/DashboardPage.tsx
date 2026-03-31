import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Conversation, ConversationStatus, User } from '../types';
import StatusBadge from '../components/StatusBadge';
import StatusSelect from '../components/StatusSelect';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [convs, userList] = await Promise.all([
        api.getConversations(),
        api.getUsers(),
      ]);
      setConversations(convs);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (convId: string, status: ConversationStatus) => {
    try {
      await api.updateConversationStatus(convId, status);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status } : c))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const filtered = conversations.filter((c) => {
    if (filterUser && c.logged_by !== filterUser) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterFrom && c.last_message_at && c.last_message_at < filterFrom) return false;
    if (filterTo && c.last_message_at && c.last_message_at > filterTo) return false;
    return true;
  });

  if (loading) {
    return <p className="text-center text-gray-400 py-12">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">All Conversations</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
        >
          <option value="">All co-founders</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
        >
          <option value="">All statuses</option>
          {['New', 'Responded', 'Following Up', 'Converted', 'Not Interested'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          placeholder="From"
        />
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          placeholder="To"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Logged by</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No conversations found
                </td>
              </tr>
            ) : (
              filtered.map((conv) => (
                <tr
                  key={conv.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/conversation/${conv.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {(conv as any).contacts?.display_name || (conv as any).contacts?.username || '—'}
                    {(conv as any).contacts?.has_active_listing && (
                      <span className="ml-1 text-green-500 text-xs" title="Active listing">&#9679;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{conv.platform}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {(conv as any).users?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {conv.summary || '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect
                      value={conv.status}
                      onChange={(status) => handleStatusChange(conv.id, status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {filtered.length} of {conversations.length} conversations
      </p>
    </div>
  );
}
