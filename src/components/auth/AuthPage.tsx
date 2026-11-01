import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, LockKeyhole } from 'lucide-react';
import { supabase, authRedirect } from '../../services/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../utils/navigation';
import './AuthPage.css';

type Mode = 'signin' | 'signup' | 'reset' | 'recovery';
export function AuthPage() {
  const { session, recovery, finishRecovery, error: sessionError } = useAuth();
  const queryMode = new URLSearchParams(window.location.search).get('mode');
  const [mode, setMode] = useState<Mode>(recovery || queryMode === 'recovery' ? 'recovery' : queryMode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description') || sessionError);
  const [message, setMessage] = useState('');
  const switchMode = (next: Mode) => { setMode(next); setError(''); setMessage(''); setPassword(''); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'recovery') {
        if (!session) throw new Error('Open the password reset link from your email first.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        finishRecovery(); navigate('/app');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('recovery') });
        if (error) throw error;
        setMessage('If an account exists for this address, a password reset link is on its way.');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } });
        if (error) throw error;
        if (data.session) navigate('/app');
        else setMessage('Check your email to confirm your account, then come back to sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate('/app');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  const title = { signin: 'A little more focus.', signup: 'Make room for what matters.', reset: 'Let’s get you back in.', recovery: 'A fresh start.' }[mode];
  return <main className="auth-page">
    <button className="auth-back" onClick={() => navigate('/')}><ArrowLeft size={17} /> Back to Todop</button>
    <div className="auth-layout">
      <div className="auth-story"><span className="auth-wordmark"><span>✓</span> todop.</span><p className="auth-eyebrow">YOUR DAY, WITH A LITTLE DIRECTION</p><h1>{title}</h1><p>One quiet place for your tasks, projects, and everything coming up next.</p><div className="auth-note"><LockKeyhole size={18} /><span>Your planner belongs to you. Your account keeps it together across devices.</span></div></div>
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{{ signin: 'Welcome back', signup: 'Create your account', reset: 'Reset your password', recovery: 'Choose a new password' }[mode]}</h2>
        {session && mode !== 'recovery' && <button className="auth-submit" onClick={() => navigate('/app')}>Open your planner <ArrowUpRight size={18} /></button>}
        {mode === 'recovery' && !session && <p className="auth-error" role="alert">This reset link is missing or expired. <button type="button" onClick={() => switchMode('reset')}>Request another reset link.</button></p>}
        <form onSubmit={submit}>
          {mode !== 'recovery' && <label>Email address<input autoFocus type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>}
          {mode !== 'reset' && <label>Password<input autoFocus={mode === 'recovery'} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signin' ? 1 : 8} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'} /></label>}
          {mode === 'signin' && <button type="button" className="auth-text-button" onClick={() => switchMode('reset')}>Forgot password?</button>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status"><Check size={18} />{message}</p>}
          <button className="auth-submit" disabled={busy || (mode === 'recovery' && !session)}>{busy ? 'One moment…' : { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', recovery: 'Save new password' }[mode]}<ArrowUpRight size={18} /></button>
        </form>
        <div className="auth-switch">{mode === 'signin' ? <>New here? <button onClick={() => switchMode('signup')}>Create an account</button></> : <button onClick={() => switchMode('signin')}>Back to sign in</button>}</div>
        <div className="auth-divider"><span>or keep it on this device</span></div><button className="auth-guest" onClick={() => navigate('/app')}>Continue without an account</button>
      </section>
    </div>
  </main>;
}
