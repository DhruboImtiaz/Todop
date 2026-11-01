import { Check } from 'lucide-react';
import './BrandLogo.css';

/** One wordmark and green tick for the front page, account screens, and workspace. */
export function BrandLogo({ small = false }: { small?: boolean }) {
  return <span className={`brand-logo${small ? ' brand-logo--small' : ''}`} aria-hidden="true">
    <span className="brand-logo-mark"><Check strokeWidth={3} /></span>
    <span className="brand-logo-name">todop<span className="brand-logo-period">.</span></span>
  </span>;
}
