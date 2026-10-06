import React, { useState } from 'react';
import { User, Mail, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient'; // Import your local data store client

export default function LoginScreen({ onAuthenticated }) {
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    const trimmedName = loginName.trim();
    const trimmedEmail = loginEmail.trim();

    // 1. Basic validation
    if (!trimmedName || !trimmedEmail) {
      setLoginError('Please enter both your full name and email address.');
      return;
    }

    // 2. Strict Domain Validation
    const allowedDomains = ['swiggy.in', 'external.swiggyimnet.in', 'scootsy.com','external.instamart.in'];
    const emailDomain = trimmedEmail.split('@')[1]?.toLowerCase();

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      setLoginError('Please use a valid company email address (@swiggy.in, @external.swiggyimnet.in, or @scootsy.com).');
      return;
    }

    setIsSubmittingLogin(true);

    try {
      // 3. Check if the user already exists in the database
      let { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', trimmedEmail)
        .maybeSingle(); 

      if (fetchError) {
        throw new Error(fetchError.message || 'Database error occurred.');
      }

      // 4. If the user DOES NOT exist, auto-create them!
      if (!user) {
        const newUserPayload = {
          user_id: `USR-${Date.now()}`,
          full_name: trimmedName,
          email: trimmedEmail,
          role: 'AUDITOR', // Default role for new sign-ups
          active: true,
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert([newUserPayload])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to auto-register user:', insertError);
          throw new Error(`Could not create your account in Supabase: ${insertError.message}`);
        } else {
          user = insertedUser;
        }
      } else {
        // 5. If the user DOES exist, verify they are active and update their login time
        if (!user.active) {
          throw new Error('This account is deactivated. Please contact support.');
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('user_id', user.user_id);

        if (updateError) {
          throw new Error(`Could not update your account in Supabase: ${updateError.message}`);
        }
      }

      // 6. Pass the authenticated user back to App.jsx
      setIsSubmittingLogin(false);
      onAuthenticated({
        user_id: user.user_id,
        name: user.full_name || trimmedName,
        email: user.email,
        role: user.role,
        home_cluster: user.home_cluster || '',
        additional_cluster: user.additional_cluster || ''
      });

    } catch (err) {
      console.error('Login Error:', err);
      setIsSubmittingLogin(false);
      setLoginError(err.message || 'Server error during login. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-orange-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10 max-w-7xl w-full mx-auto">
        <div className="w-10 h-10 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-600/30">
          IM
        </div>
        <span className="font-black text-xl text-white tracking-tight">IM VITALS</span>
      </div>

      <div className="my-auto py-8 relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full mx-auto shadow-2xl border border-white/20 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles className="w-3 h-3" /> Operations Platform
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome</h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Enter your details to access standards, forms, and audits.
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-600 text-xs font-semibold text-center leading-normal">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingLogin ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium">
              Protected by IM VITALS Operations Engine
            </span>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 font-medium relative z-10 max-w-7xl w-full mx-auto">
        © {new Date().getFullYear()} IM VITALS Platform. All rights reserved.
      </div>
    </div>
  );
}
