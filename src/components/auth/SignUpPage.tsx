import React, { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import './AuthPages.css';

interface SignUpPageProps {
  onNavigateToLogin: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigateToLogin }) => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    const result = await signUp(email, password);
    
    setIsLoading(false);
    
    if (result.error) {
      setError(result.error.message);
    } else {
      // If email confirmation is enabled, session won't be set immediately.
      // The auth provider session will remain null, so we show a success message.
      setIsSuccess(true);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We've sent a confirmation link to <strong>{email}</strong>. 
              Please verify your email to log in.
            </p>
          </div>
          <button 
            type="button" 
            className="auth-submit-btn" 
            onClick={onNavigateToLogin}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-subtitle">Sign up for TODOP to sync your tasks securely.</p>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="signup-email" className="auth-label">
              Email Address
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="auth-label">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading || !email.trim() || !password}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Already have an account?{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={onNavigateToLogin}
              disabled={isLoading}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
