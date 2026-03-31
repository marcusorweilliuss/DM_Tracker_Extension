import { ConversationStatus } from '../types';

const statuses: ConversationStatus[] = [
  'New',
  'Leave it',
  'To Follow Up',
  'Converted',
  'Other',
];

interface StatusSelectProps {
  value: ConversationStatus;
  onChange: (status: ConversationStatus) => void;
}

export default function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ConversationStatus)}
      className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
