import React from 'react';
import { Plus } from 'lucide-react';
import './FloatingAddButton.css';

interface FloatingAddButtonProps {
  onClick: () => void;
}

export const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      className="floating-add-btn"
      onClick={onClick}
      aria-label="Create new task log"
      title="Create new log"
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
};
