import { useStorage } from '../../hooks/useStorage';
export function ErrorBanner() {
  const { error, dismissError } = useStorage();
  return error ? <div className="workspace-error" role="alert"><span>{error}</span><button onClick={dismissError} aria-label="Dismiss save error">×</button></div> : null;
}
