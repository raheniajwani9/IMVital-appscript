import React, { useState } from 'react';
import { User, Mail, LockKeyhole, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';

const ALLOWED_DOMAINS = ['swiggy.in', 'external.swiggyimnet.in', 'swiggyimnet.in', 'swiggyiment.in', 'scootsy.com', 'external.instamart.in','external.scootsy.com'];

export default function LoginScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const validateEmail = (value) => {
    const domain = value.trim().toLowerCase().split('@')[1];
    return domain && ALLOWED_DOMAINS.includes(domain);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const cleanEmail = email.trim().toLowerCase();

    if (!validateEmail(cleanEmail)) {
      setError('Use your company email address to continue.');
      return;
    }
    if (isSignup && !fullName.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (isSignup && password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: fullName.trim() } }
        });
        if (signupError) throw signupError;

        // Require an explicit sign-in after registration even if email confirmation is disabled.
        if (data.session) await supabase.auth.signOut();
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
        setNotice(data.user?.identities?.length === 0
          ? 'An account already exists for this email. Sign in or reset your password.'
          : 'Account created. Sign in with your email and password.');
        return;
      }

      const { data, error: signinError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      if (signinError) throw signinError;

      const { data: profiles, error: profileError } = await supabase.rpc('get_my_profile');
      console.log('Retrieved profile for user:', data.user?.id, data.user?.email, profiles);
      if (profileError) throw profileError;
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      if (!profile) {
        console.log('No profile found for user:', data.user?.id, data.user?.email);
        await supabase.auth.signOut();
        throw new Error('Your profile is not set up yet. Contact your administrator.');
      }
      if (!profile.active) {
        await supabase.auth.signOut();
        throw new Error('This account is deactivated. Please contact support.');
      }

      const { error: updateError } = await supabase.rpc('record_my_login');
      if (updateError) console.warn('Could not update last login time:', updateError);

      onAuthenticated({
        user_id: profile.user_id,
        name: profile.full_name || fullName.trim(),
        email: profile.email,
        role: profile.role,
        home_cluster: profile.home_cluster || '',
        additional_cluster: profile.additional_cluster || ''
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-slate-950 p-6 font-sans">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[400px] rounded-full bg-orange-600/10 blur-[100px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-lg font-black text-white shadow-lg shadow-orange-600/30">IM</div>
        <span className="text-xl font-black tracking-tight text-white">IM VITALS</span>
      </header>

      <main className="relative z-10 my-auto py-8">
        <section className="mx-auto w-full max-w-md space-y-6 rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
              <Sparkles className="h-3 w-3" /> Operations Platform
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mx-auto max-w-xs text-xs text-slate-500">
              {isSignup ? 'Create an account to access the IM Vitals workspace.' : 'Sign in to access standards, forms, and audits.'}
            </p>
          </div>

          {error && <div role="alert" className="rounded-2xl border border-rose-200/80 bg-rose-50 p-3 text-center text-xs font-semibold leading-normal text-rose-600">{error}</div>}
          {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-semibold leading-normal text-emerald-700">{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label htmlFor="signup-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input id="signup-name" type="text" autoComplete="name" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">{isSignup ? 'Create password' : 'Password'}</label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input id="auth-password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            {isSignup && (
              <div>
                <label htmlFor="auth-confirm-password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Confirm password</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input id="auth-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter your password again" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            )}
            <button type="submit" disabled={busy} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{isSignup ? 'Create account' : 'Sign in to workspace'}</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              {isSignup ? 'Already have an account?' : 'New to IM Vitals?'}{' '}
              <button type="button" onClick={() => switchMode(isSignup ? 'signin' : 'signup')} className="cursor-pointer font-bold text-blue-600 hover:text-blue-700">
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
            <p className="mt-4 text-[10px] font-medium text-slate-400">Protected by IM VITALS Operations Engine</p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-7xl text-center text-[11px] font-medium text-slate-500">© {new Date().getFullYear()} IM VITALS Platform. All rights reserved.</footer>
    </div>
  );
}

