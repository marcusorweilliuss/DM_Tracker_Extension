import { ConversationStatus } from '../types';

const statusColors: Record<ConversationStatus, string> = {
  New: 'bg-blue-100 text-blue-700',
  Responded: 'bg-green-100 text-green-700',
  'Following Up': 'bg-yellow-100 text-yellow-700',
  Converted: 'bg-purple-100 text-purple-700',
  'Not Interested': 'bg-gray-100 text-gray-500',
};

interface StatusBadgeProps {
  status: ConversationStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
      {status}
    </span>
  );
}
