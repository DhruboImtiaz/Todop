import React from 'react';
import { Search } from 'lucide-react';
import './Placeholder.css';

interface SearchPlaceholderProps {
  onBackToUpcoming: () => void;
}

export const SearchPlaceholder: React.FC<SearchPlaceholderProps> = ({
  onBackToUpcoming,
}) => {
  return (
    <section className="placeholder-page" aria-labelledby="search-heading">
      <div className="placeholder-header">
        <h1 id="search-heading" className="placeholder-title">
          SEARCH
        </h1>
        <p className="placeholder-subtitle">Find tasks across your archive</p>
      </div>

      <div className="placeholder-card">
        <div className="placeholder-icon" aria-hidden="true">
          <Search size={24} strokeWidth={2} />
        </div>
        <span className="placeholder-tag">Phase 2 Roadmap</span>
        <p className="placeholder-text">
          Global instant search across both active and completed task archives will arrive in Phase 2.
        </p>
        <button
          type="button"
          className="placeholder-back-btn"
          onClick={onBackToUpcoming}
        >
          Back to Upcoming
        </button>
      </div>
    </section>
  );
};
