import { Plus } from 'lucide-react';
import './FloatingAddButton.css';

interface FloatingAddButtonProps {
  onClick: () => void;
}

export function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      type="button"
      className="floating-add-btn"
      onClick={onClick}
      aria-label="Create new task log"
      title="Create new log"
    >
      <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
