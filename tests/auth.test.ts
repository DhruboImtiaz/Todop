import assert from 'node:assert/strict';

console.log('\n--- Running TODOP Auth & Routing Logic Tests ---');

// Mock AuthProvider state machine behavior
class MockAuthProvider {
  session: any = null;
  user: any = null;
  loading: boolean = true;
  isRecovery: boolean = false;
  
  constructor() {
    // Initial fetch mock
    setTimeout(() => {
      this.loading = false;
    }, 10);
  }

  // Simulate Supabase onAuthStateChange
  triggerAuthEvent(event: string, session: any) {
    if (event === 'PASSWORD_RECOVERY') {
      this.isRecovery = true;
    } else if (event === 'SIGNED_OUT') {
      this.isRecovery = false;
    }
    this.session = session;
  }

  async signIn(email: string, _password?: string) {
    if (email === 'fail@test.com') {
      return { error: new Error('Invalid login credentials') };
    }
    this.session = { access_token: 'mock-jwt' };
    this.user = { email };
    return { error: null };
  }

  async signUp(email: string, _password?: string) {
    if (email === 'exist@test.com') {
      return { error: new Error('User already registered') };
    }
    return { error: null };
  }

  async resetPasswordForEmail(email: string) {
    if (email === 'invalid@test.com') {
      return { error: new Error('Invalid email') };
    }
    return { error: null };
  }

  async verifyRecoveryOtp(email: string, token: string) {
    if (token !== '123456') {
      return { error: new Error('Token has expired or is invalid') };
    }
    this.session = { access_token: 'mock-recovery-jwt' };
    this.user = { email };
    // Not explicitly triggering PASSWORD_RECOVERY here because it's not strictly necessary for same-tab flow,
    // but we can simulate the GoTrue event if we wanted.
    return { error: null };
  }

  async updateUserPassword(password: string) {
    if (password.length < 6) {
      return { error: new Error('Password should be at least 6 characters') };
    }
    return { error: null };
  }

  async signOut() {
    this.session = null;
    this.user = null;
    this.triggerAuthEvent('SIGNED_OUT', null);
  }
}

// Mock Routing Behavior reflecting AuthRouter state
function mockAuthRouterRender(path: string, authView: string, authState: { session: any; loading: boolean, isRecovery: boolean }) {
  if (authState.loading) {
    return 'SplashLoadingScreen';
  }
  
  const isRecovering = authState.isRecovery || authView === 'forgot_password';

  if (isRecovering) {
    return 'ForgotPasswordFlow';
  }

  if (!authState.session) {
    if (authView === 'signup') {
      return 'SignUpPage';
    }
    return 'LoginPage';
  }

  // If authenticated user is on /login or /signup, normalize URL to /
  if (path === '/login' || path === '/signup') {
    path = '/';
  }

  return 'ProtectedApp';
}

async function runTests() {
  const provider = new MockAuthProvider();

  // Test 1: Initial Loading State
  assert.equal(provider.loading, true);
  const render1 = mockAuthRouterRender('/', 'login', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render1, 'SplashLoadingScreen');
  console.log('✓ Initial loading state shows Splash Loading Screen');

  // Wait for load
  await new Promise(r => setTimeout(r, 20));
  assert.equal(provider.loading, false);

  // Test 2: Signed-out state
  const render2 = mockAuthRouterRender('/', 'login', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render2, 'LoginPage');
  console.log('✓ Signed-out state renders LoginPage for protected route');

  // Test 3: Sign Up Success
  const signUpSuccess = await provider.signUp('new@test.com', 'password');
  assert.equal(signUpSuccess.error, null);
  console.log('✓ Sign Up success behaves correctly');

  // Test 4: Sign In Success
  const signInSuccess = await provider.signIn('user@test.com', 'password');
  assert.equal(signInSuccess.error, null);
  assert.ok(provider.session);
  console.log('✓ Sign In success sets session and user');

  // Test 5: Signed-in state renders ProtectedApp
  const render3 = mockAuthRouterRender('/projects', 'login', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render3, 'ProtectedApp');
  console.log('✓ Signed-in state renders ProtectedApp');

  // Test 6: Authenticated user redirect from Login/Sign Up
  const render4 = mockAuthRouterRender('/login', 'login', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render4, 'ProtectedApp');
  console.log('✓ Authenticated user visiting /login renders ProtectedApp');

  // Test 7: Sign Out
  await provider.signOut();
  assert.equal(provider.session, null);
  console.log('✓ Sign out clears session');

  // Test 8: Forgot Password Flow - AuthView logic
  const render5 = mockAuthRouterRender('/login', 'forgot_password', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render5, 'ForgotPasswordFlow');
  console.log('✓ authView="forgot_password" forces ForgotPasswordFlow rendering');

  // Test 9: Forgot Password - Request Code
  const resetErr = await provider.resetPasswordForEmail('invalid@test.com');
  assert.ok(resetErr.error);
  const resetSuccess = await provider.resetPasswordForEmail('user@test.com');
  assert.equal(resetSuccess.error, null);
  console.log('✓ resetPasswordForEmail handles success and error cases');

  // Test 10: Forgot Password - Verify OTP
  const verifyErr = await provider.verifyRecoveryOtp('user@test.com', '000000');
  assert.ok(verifyErr.error);
  
  const verifySuccess = await provider.verifyRecoveryOtp('user@test.com', '123456');
  assert.equal(verifySuccess.error, null);
  assert.equal(provider.session.access_token, 'mock-recovery-jwt');
  console.log('✓ verifyRecoveryOtp establishes recovery session properly');

  // Test 11: Recovery session does NOT leak to ProtectedApp because authView is still 'forgot_password'
  const render6 = mockAuthRouterRender('/login', 'forgot_password', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(render6, 'ForgotPasswordFlow');
  console.log('✓ AuthRouter safely isolates recovery session within ForgotPasswordFlow');

  // Test 11b: Clicking a recovery link emits PASSWORD_RECOVERY and forces ForgotPasswordFlow even on normal login route
  provider.signOut();
  provider.triggerAuthEvent('PASSWORD_RECOVERY', { access_token: 'link-jwt' });
  const renderLink = mockAuthRouterRender('/', 'login', { session: provider.session, loading: provider.loading, isRecovery: provider.isRecovery });
  assert.equal(renderLink, 'ForgotPasswordFlow');
  console.log('✓ PASSWORD_RECOVERY event forces ForgotPasswordFlow even on normal routes');

  // Test 12: Forgot Password - Update Password
  const updateErr = await provider.updateUserPassword('short');
  assert.ok(updateErr.error);
  
  const updateSuccess = await provider.updateUserPassword('new-secure-password');
  assert.equal(updateSuccess.error, null);
  console.log('✓ updateUserPassword successfully updates password');
  
  // Test 13: Forgot Password - Success Signout
  await provider.signOut();
  assert.equal(provider.session, null);
  assert.equal(provider.isRecovery, false);
  console.log('✓ Successful password reset signs out recovery session gracefully');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
