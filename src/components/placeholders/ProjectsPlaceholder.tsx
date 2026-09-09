import React from 'react';
import { FolderGit2 } from 'lucide-react';
import './Placeholder.css';

interface ProjectsPlaceholderProps {
  onBackToUpcoming: () => void;
}

export const ProjectsPlaceholder: React.FC<ProjectsPlaceholderProps> = ({
  onBackToUpcoming,
}) => {
  return (
    <section className="placeholder-page" aria-labelledby="projects-heading">
      <div className="placeholder-header">
        <h1 id="projects-heading" className="placeholder-title">
          PROJECTS
        </h1>
        <p className="placeholder-subtitle">Organize logs into focused projects</p>
      </div>

      <div className="placeholder-card">
        <div className="placeholder-icon" aria-hidden="true">
          <FolderGit2 size={24} strokeWidth={2} />
        </div>
        <span className="placeholder-tag">Phase 2 Roadmap</span>
        <p className="placeholder-text">
          Project grouping and color tags will be available in Phase 2. Tasks with assigned projects currently appear seamlessly in Upcoming.
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
