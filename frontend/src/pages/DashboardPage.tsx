import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Conversation, ConversationStatus, User } from '../types';
import StatusSelect from '../components/StatusSelect';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';

const STATUS_COLORS: Record<string, string> = {
  'New': '#6b7280',
  'Leave it': '#9ca3af',
  'To Follow Up': '#f59e0b',
  'Converted': '#10b981',
  'Other': '#8b5cf6',
};

const SUMMARY_KEYWORDS = ['Interested', 'No response', 'Not interested', 'Had questions', 'Responded', 'Awaiting response', 'Outreach'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [filterSummary, setFilterSummary] = useState('');
  const [filterFlagged, setFilterFlagged] = useState(false);

  // Charts visibility
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (editingCell && editInputRef.current) editInputRef.current.focus();
  }, [editingCell]);

  const loadData = async () => {
    try {
      const [convs, userList] = await Promise.all([api.getConversations(), api.getUsers()]);
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
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, status } : c)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // ── Selection ────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  // ── Delete ───────────────────────────────────────────
  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) { console.error('Failed to delete:', err); }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} conversation${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      await api.bulkDeleteConversations(Array.from(selectedIds));
      setConversations((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    } catch (err) { console.error('Failed to bulk delete:', err); }
  };

  // ── Flag Toggle ──────────────────────────────────────
  const handleToggleFlag = async (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    const newFlagged = !conv.flagged;
    try {
      await api.updateConversation(convId, { flagged: newFlagged });
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, flagged: newFlagged } : c)));
    } catch (err) { console.error('Failed to toggle flag:', err); }
  };

  // ── Inline Editing ───────────────────────────────────
  const startEditing = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    try {
      if (field === 'summary') {
        await api.updateConversation(id, { summary: editValue });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, summary: editValue } : c)));
      } else if (field === 'notes') {
        await api.updateConversation(id, { notes: editValue });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, notes: editValue } : c)));
      } else if (field === 'contact_name') {
        await api.updateConversation(id, { contact_display_name: editValue });
        setConversations((prev) => prev.map((c) => {
          if (c.id !== id) return c;
          const updated = { ...c };
          if ((updated as any).contacts) {
            (updated as any).contacts = { ...(updated as any).contacts, display_name: editValue };
          }
          return updated;
        }));
      }
    } catch (err) { console.error('Failed to save edit:', err); }
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(''); };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  // ── Filtering ────────────────────────────────────────
  const filtered = conversations.filter((c) => {
    const contact = (c as any).contacts;
    if (filterUser && c.logged_by !== filterUser) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterFrom && c.last_message_at && c.last_message_at < filterFrom) return false;
    if (filterTo && c.last_message_at && c.last_message_at > filterTo) return false;
    if (filterUsername) {
      const name = (contact?.display_name || contact?.username || '').toLowerCase();
      if (!name.includes(filterUsername.toLowerCase())) return false;
    }
    if (filterSummary) {
      const summary = (c.summary || '').toLowerCase();
      if (!summary.includes(filterSummary.toLowerCase())) return false;
    }
    if (filterFlagged && !c.flagged) return false;
    return true;
  });

  // ── Chart Data (auto-syncs with filters) ─────────────
  const chartData = useMemo(() => {
    // Status breakdown
    const statusCounts: Record<string, number> = {};
    filtered.forEach((c) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });
    const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({
      name, value, fill: STATUS_COLORS[name] || '#8884d8',
    }));

    // Summary outcome breakdown
    const outcomeCounts: Record<string, number> = {};
    filtered.forEach((c) => {
      const summary = c.summary || '';
      // Extract the outcome part after the dash
      const parts = summary.split('—');
      const outcome = parts.length > 1 ? parts[1].trim() : 'Unknown';
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });
    const outcomeBarData = Object.entries(outcomeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Conversations over time (by week)
    const timeData: Record<string, number> = {};
    filtered.forEach((c) => {
      if (c.last_message_at) {
        const d = new Date(c.last_message_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        timeData[key] = (timeData[key] || 0) + 1;
      }
    });
    const timelineData = Object.entries(timeData).map(([date, count]) => ({ date, count }));

    // Per co-founder breakdown
    const userCounts: Record<string, number> = {};
    filtered.forEach((c) => {
      const userName = (c as any).users?.name || 'Unknown';
      userCounts[userName] = (userCounts[userName] || 0) + 1;
    });
    const userBarData = Object.entries(userCounts).map(([name, count]) => ({ name, count }));

    return { statusPieData, outcomeBarData, timelineData, userBarData };
  }, [filtered]);

  // ── Excel Export ─────────────────────────────────────
  const exportToExcel = () => {
    const rows = filtered.map((c) => {
      const contact = (c as any).contacts;
      return {
        'Contact': contact?.display_name || contact?.username || '',
        'Username': contact?.username || '',
        'Platform': c.platform,
        'Logged By': (c as any).users?.name || '',
        'Status': c.status,
        'Summary': c.summary || '',
        'Notes': c.notes || '',
        'Flagged': c.flagged ? 'Yes' : 'No',
        'Last Message': c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '',
        'Profile URL': contact?.profile_url || '',
        'Has Active Listing': contact?.has_active_listing ? 'Yes' : 'No',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conversations');

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || '').length).slice(0, 50)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `dm-tracker-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <p className="text-center text-gray-400 py-12">Loading...</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">All Conversations</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
              Delete {selectedIds.size} selected
            </button>
          )}
          <button onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export Excel
          </button>
          <button onClick={async () => {
              if (!confirm('This will remove all spam accounts and conversations that don\'t mention "refit". Continue?')) return;
              try {
                const result = await api.cleanupConversations();
                alert(result.message);
                fetchConversations();
              } catch (err: any) {
                alert('Cleanup failed: ' + err.message);
              }
            }}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
            Cleanup Junk
          </button>
          <button onClick={() => setShowCharts(!showCharts)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${showCharts ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={filterUsername}
          onChange={(e) => setFilterUsername(e.target.value)}
          placeholder="Search username..."
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-44"
        />
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5">
          <option value="">All co-founders</option>
          {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5">
          <option value="">All next steps</option>
          {['New', 'Leave it', 'To Follow Up', 'Converted', 'Other'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterSummary} onChange={(e) => setFilterSummary(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5">
          <option value="">All outcomes</option>
          {SUMMARY_KEYWORDS.map((s) => (<option key={s} value={s.toLowerCase()}>{s}</option>))}
        </select>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5" />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5" />
        <button onClick={() => setFilterFlagged(!filterFlagged)}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1 ${filterFlagged ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-gray-300 text-gray-500 hover:border-amber-300'}`}>
          <span className={filterFlagged ? '' : 'opacity-50'}>&#9873;</span> Flagged
        </button>
        {(filterUsername || filterUser || filterStatus || filterFrom || filterTo || filterSummary || filterFlagged) && (
          <button onClick={() => { setFilterUsername(''); setFilterUser(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); setFilterSummary(''); setFilterFlagged(false); }}
            className="text-sm text-red-500 hover:text-red-700 px-2 py-1.5">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll} className="rounded border-gray-300" />
              </th>
              <th className="px-3 py-3 w-10">&#9873;</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Logged by</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Next Steps</th>
              <th className="px-4 py-3">Last Message</th>
              <th className="px-4 py-3 w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No conversations found</td></tr>
            ) : (
              filtered.map((conv) => {
                const contact = (conv as any).contacts;
                const isSelected = selectedIds.has(conv.id);
                const isEditingContact = editingCell?.id === conv.id && editingCell?.field === 'contact_name';
                const isEditingSummary = editingCell?.id === conv.id && editingCell?.field === 'summary';

                return (
                  <tr key={conv.id} className={`transition-colors ${isSelected ? 'bg-pink-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(conv.id)} className="rounded border-gray-300" />
                    </td>
                    {/* Flag */}
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleToggleFlag(conv.id)}
                        className={`text-lg transition-colors ${conv.flagged ? 'text-amber-500 hover:text-amber-600' : 'text-gray-200 hover:text-amber-400'}`}
                        title={conv.flagged ? 'Remove flag' : 'Flag this conversation'}>
                        &#9873;
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800" onClick={(e) => e.stopPropagation()}>
                      {isEditingContact ? (
                        <input ref={editInputRef as React.RefObject<HTMLInputElement>} type="text" value={editValue}
                          onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown}
                          className="w-full border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                      ) : (
                        <span className="cursor-pointer hover:underline hover:text-brand-500"
                          onClick={() => navigate(`/conversation/${conv.id}`)}
                          onDoubleClick={() => startEditing(conv.id, 'contact_name', contact?.display_name || contact?.username || '')}
                          title="Double-click to edit">
                          {contact?.display_name || contact?.username || '—'}
                          {contact?.has_active_listing && <span className="ml-1 text-green-500 text-xs" title="Active listing">&#9679;</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize cursor-pointer" onClick={() => navigate(`/conversation/${conv.id}`)}>{conv.platform}</td>
                    <td className="px-4 py-3 text-gray-500 cursor-pointer" onClick={() => navigate(`/conversation/${conv.id}`)}>{(conv as any).users?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {isEditingSummary ? (
                        <textarea ref={editInputRef as React.RefObject<HTMLTextAreaElement>} value={editValue}
                          onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} rows={2}
                          className="w-full border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
                      ) : (
                        <span className="block truncate cursor-text hover:text-gray-700"
                          onDoubleClick={() => startEditing(conv.id, 'summary', conv.summary || '')}
                          title={conv.summary ? `${conv.summary}\n\nDouble-click to edit` : 'Double-click to edit'}>
                          {conv.summary || '—'}
                        </span>
                      )}
                    </td>
                    {/* Notes — editable */}
                    <td className="px-4 py-3 text-gray-500 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {editingCell?.id === conv.id && editingCell?.field === 'notes' ? (
                        <textarea ref={editInputRef as React.RefObject<HTMLTextAreaElement>} value={editValue}
                          onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} rows={2}
                          className="w-full border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                          placeholder="Add notes..." />
                      ) : (
                        <span className="block truncate cursor-text hover:text-gray-700"
                          onDoubleClick={() => startEditing(conv.id, 'notes', conv.notes || '')}
                          title={conv.notes ? `${conv.notes}\n\nDouble-click to edit` : 'Double-click to add notes'}>
                          {conv.notes || <span className="text-gray-300 italic">Add notes...</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect value={conv.status} onChange={(status) => handleStatusChange(conv.id, status)} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs cursor-pointer" onClick={() => navigate(`/conversation/${conv.id}`)}>
                      {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDeleteSingle(conv.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete conversation">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {filtered.length} of {conversations.length} conversations
        {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
        <span className="ml-2 text-gray-300">· Double-click contact or summary to edit</span>
      </p>

      {/* ── Charts Section ────────────────────────────────── */}
      {showCharts && filtered.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Breakdown Pie Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Next Steps Breakdown</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData.statusPieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                  {chartData.statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Outcome Breakdown Bar Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Outreach Outcomes</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData.outcomeBarData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#d6336c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conversations Over Time */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Conversations Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData.timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#d6336c" strokeWidth={2} dot={{ fill: '#d6336c' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per Co-founder Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Conversations by Co-founder</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData.userBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
