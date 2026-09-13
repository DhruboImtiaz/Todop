import React, { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import './AuthPages.css';

interface ForgotPasswordFlowProps {
  onReturnToLogin: () => void;
}

type FlowStep = 'email' | 'verify' | 'new_password' | 'success';

export const ForgotPasswordFlow: React.FC<ForgotPasswordFlowProps> = ({ onReturnToLogin }) => {
  const { resetPasswordForEmail, verifyRecoveryOtp, updateUserPassword, signOut, session } = useAuth();
  
  const [step, setStep] = useState<FlowStep>(() => {
    return session ? 'new_password' : 'email';
  });
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [cooldown, setCooldown] = useState(0);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const result = await resetPasswordForEmail(email.trim());
    
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    
    setIsLoading(false);
    setStep('verify');
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const result = await verifyRecoveryOtp(email.trim(), pin.trim());
    
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
    setStep('new_password');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const result = await updateUserPassword(newPassword);
    
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    
    // Sign out of the temporary recovery session so they can log back in normally
    await signOut();
    
    setIsLoading(false);
    setStep('success');
  };

  const handleReturnToLogin = async () => {
    // If they abandon flow halfway through after verifying, we should sign them out
    if (step === 'new_password') {
      await signOut();
    }
    onReturnToLogin();
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        
        {step === 'email' && (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Forgot Password</h1>
              <p className="auth-subtitle">Enter your email and we'll send you a 6-digit code.</p>
            </div>
            {error && <div className="auth-error-banner" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={handleSendCode} noValidate>
              <div className="auth-field">
                <label htmlFor="recovery-email" className="auth-label">Email Address</label>
                <input
                  id="recovery-email"
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
              <button type="submit" className="auth-submit-btn" disabled={isLoading || !email.trim()}>
                {isLoading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Verify Code</h1>
              <p className="auth-subtitle">
                If an account exists for this email, we've sent a verification code.
              </p>
            </div>
            {error && <div className="auth-error-banner" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={handleVerify} noValidate>
              <div className="auth-field">
                <label htmlFor="recovery-pin" className="auth-label">6-Digit Code</label>
                <input
                  id="recovery-pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="auth-input auth-pin-input"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPin(val);
                  }}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={isLoading || pin.length !== 6}>
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <div className="auth-resend-container">
                <button 
                  type="button" 
                  className="auth-link-btn" 
                  onClick={handleSendCode} 
                  disabled={isLoading || cooldown > 0}
                >
                  {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'new_password' && (
          <>
            <div className="auth-header">
              <h1 className="auth-title">New Password</h1>
              <p className="auth-subtitle">Choose a new password for your account.</p>
            </div>
            {error && <div className="auth-error-banner" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={handleUpdatePassword} noValidate>
              <div className="auth-field">
                <label htmlFor="new-password" className="auth-label">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="auth-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="confirm-password" className="auth-label">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="auth-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="auth-submit-btn" 
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading ? 'Updating...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Password Updated</h1>
              <p className="auth-subtitle">Your password has been changed successfully.</p>
            </div>
            <div className="auth-form">
              <button type="button" className="auth-submit-btn" onClick={onReturnToLogin}>
                Back to Login
              </button>
            </div>
          </>
        )}

        {step !== 'success' && (
          <div className="auth-footer">
            <button type="button" className="auth-link-btn" onClick={handleReturnToLogin} disabled={isLoading}>
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
