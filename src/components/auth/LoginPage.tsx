import React, { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import './AuthPages.css';

interface LoginPageProps {
  onNavigateToSignUp: () => void;
  onNavigateToForgotPassword?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToSignUp, onNavigateToForgotPassword }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    const result = await signIn(email, password);
    
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
    }
    // If successful, AuthProvider's onAuthStateChange will automatically redirect us via App.tsx
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Log in to TODOP to manage your tasks.</p>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="login-email" className="auth-label">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password" className="auth-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading || !email.trim() || !password}
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
          
          <div className="auth-forgot-password">
            <button
              type="button"
              className="auth-link-btn"
              onClick={onNavigateToForgotPassword}
              disabled={isLoading}
            >
              Forgot Password?
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={onNavigateToSignUp}
              disabled={isLoading}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
