'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  async function google() {
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/en/today` } });
    if (error) setMsg(error.message);
  }
  async function magic() {
    if (!email) return;
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/en/today` } });
    setMsg(error ? error.message : 'Check email for login link ✓');
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Login</h1>
      <button onClick={google} className="rounded-2xl bg-ink px-6 py-4 font-bold text-white min-h-[56px]">Continue with Google</button>
      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" aria-label="Email"
          className="flex-1 rounded-2xl border p-4 min-h-[56px]" />
        <button onClick={magic} className="rounded-2xl bg-leaf px-5 py-4 font-bold text-white min-h-[56px]">Link</button>
      </div>
      {msg && <p className="text-sm font-bold text-leaf">{msg}</p>}
      <p className="text-sm text-muted">No password. Works without login too (local mode).</p>
    </div>
  );
}
