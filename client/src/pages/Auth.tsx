import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type AuthView = 'signin' | 'signup' | 'forgot';

export default function Auth() {
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    let t = 0;
    const loop = () => {
      t += 0.012;
      setTick(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  const reset = () => { setError(''); setMessage(''); };

  const handleSubmit = async () => {
    if (!email) return setError('Enter your email, pirate.');
    if (view !== 'forgot' && !password) return setError('Password required to sail these seas.');
    setLoading(true); reset();
    if (view === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) setError(error.message);
      else setMessage('Reset link sent! Check your Den Den Mushi 📡');
    } else if (view === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm your nakama status! 🏴‍☠️');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Wrong email or password. Even Nami wouldn't trust you.");
    }
    setLoading(false);
  };

  const wave = (amp: number, freq: number, phase: number, y: number) => {
    const pts = [];
    for (let x = 0; x <= 1440; x += 6) {
      const wy = y + Math.sin((x / 1440) * freq * Math.PI * 2 + phase + tick) * amp
                   + Math.sin((x / 1440) * (freq * 1.7) * Math.PI * 2 + phase * 1.3 + tick * 0.7) * (amp * 0.4);
      pts.push(`${x},${wy}`);
    }
    return `M0,${y} L${pts.join(' L')} L1440,900 L0,900 Z`;
  };

  const bubbles = [
    { cx: 120, r: 3, speed: 0.4, offset: 0 },
    { cx: 280, r: 5, speed: 0.3, offset: 1.2 },
    { cx: 450, r: 2, speed: 0.6, offset: 2.4 },
    { cx: 700, r: 4, speed: 0.25, offset: 0.8 },
    { cx: 900, r: 6, speed: 0.35, offset: 3.1 },
    { cx: 1100, r: 3, speed: 0.5, offset: 1.7 },
    { cx: 1300, r: 4, speed: 0.28, offset: 2.9 },
    { cx: 200, r: 2, speed: 0.55, offset: 4.2 },
    { cx: 600, r: 5, speed: 0.32, offset: 0.5 },
    { cx: 1050, r: 3, speed: 0.45, offset: 3.8 },
  ];

  const stars = [
    [100,60],[200,30],[350,80],[500,20],[650,55],[800,35],[950,70],[1100,25],[1250,60],[1380,40],
    [150,120],[400,100],[700,130],[1000,90],[1300,115],[50,180],[300,160],[600,200],[900,155],[1200,185],
    [80,250],[420,230],[720,260],[1020,220],[1350,245],[170,310],[470,290],[770,320],[1070,280],[1370,305],
  ];

  const titles: Record<AuthView, string> = { signin: 'Set Sail Again', signup: 'Join the Crew', forgot: 'Lost at Sea?' };
  const subtitles: Record<AuthView, string> = {
    signin: 'Your Grand Line journal awaits',
    signup: 'Trade 1 of 10,000.',
    forgot: "We'll guide you back to port",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#010810' }}
    >
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 0,
          opacity: 0.45,
        }}
      >
        <source src="/Bkg Vid.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay - keeps focus on the card */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'rgba(1, 6, 14, 0.72)',
      }} />

      {/* Stars */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.7, zIndex: 2 }}>
        {stars.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 0.8} fill="white" opacity={0.3 + Math.sin(tick * 0.5 + i) * 0.2} />
        ))}
      </svg>

      
      

      

      {/* Card */}
      <div className="relative z-10 w-full" style={{ maxWidth: 420 }}>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #d4a017, #a07010)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(212,160,23,0.4), 0 8px 24px rgba(0,0,0,0.4)',
            fontSize: 28,
          }}>🏴‍☠️</div>
        </div>

        {/* Title */}
        <div className="text-center mb-7">
          <h1 style={{
            fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif",
            fontWeight: 700, fontSize: 30, color: '#e8d5a3',
            letterSpacing: '1px', marginBottom: 8,
            textShadow: '0 2px 20px rgba(212,160,23,0.3)',
          }}>
            {titles[view]}
          </h1>
          <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: '#5b8fa8', fontWeight: 400, letterSpacing: '0.3px' }}>
            {subtitles[view]}
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(5, 18, 35, 0.88)',
          border: '1px solid rgba(56,182,224,0.15)',
          borderRadius: 22, padding: '32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,182,224,0.07) inset, 0 1px 0 rgba(255,255,255,0.05) inset',
        }}>
          {error && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13, fontFamily: "'Inter', system-ui" }}>
              {error}
            </div>
          )}
          {message && (
            <div style={{ background: 'rgba(56,182,224,0.08)', border: '1px solid rgba(56,182,224,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: '#102c48', fontSize: 13, fontFamily: "'Inter', system-ui" }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5b8fa8', marginBottom: 7, fontFamily: "'Inter', system-ui", letterSpacing: '0.8px', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="nakama@grandline.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,182,224,0.12)', borderRadius: 11, padding: '12px 15px', color: '#d4e8f0', fontSize: 14, fontFamily: "'Inter', system-ui", outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(56,182,224,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(56,182,224,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(56,182,224,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            {view !== 'forgot' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5b8fa8', marginBottom: 7, fontFamily: "'Inter', system-ui", letterSpacing: '0.8px', textTransform: 'uppercase' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,182,224,0.12)', borderRadius: 11, padding: '12px 44px 12px 15px', color: '#d4e8f0', fontSize: 14, fontFamily: "'Inter', system-ui", outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(56,182,224,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(56,182,224,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(56,182,224,0.12)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#3d6a80', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
                {view === 'signin' && (
                  <div style={{ textAlign: 'right', marginTop: 7 }}>
                    <button onClick={() => { setView('forgot'); reset(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38b6e0', fontSize: 12, fontFamily: "'Inter', system-ui", fontWeight: 500, padding: 0 }}>
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit} disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'rgba(212,160,23,0.3)' : 'linear-gradient(135deg, #d4a017 0%, #b8860b 100%)',
                border: 'none', borderRadius: 11, padding: '13px',
                color: loading ? 'rgba(255,255,255,0.5)' : '#1a0e00',
                fontSize: 14, fontWeight: 700, fontFamily: "'Inter', system-ui",
                cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
                boxShadow: loading ? 'none' : '0 4px 24px rgba(212,160,23,0.35)',
                transition: 'all 0.2s', letterSpacing: '0.3px',
              }}
            >
              {loading ? 'Navigating...' : view === 'signin' ? '⚓ Set Sail' : view === 'signup' ? '🏴‍☠️ Join the Crew' : '📡 Send Reset Link'}
            </button>
          </div>

          {/* Bottom links */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(56,182,224,0.08)', textAlign: 'center', fontSize: 13, color: '#3d6a80', fontFamily: "'Inter', system-ui" }}>
            {view === 'signin' && (<>Not in the crew yet?{' '}<button onClick={() => { setView('signup'); reset(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38b6e0', fontWeight: 600, fontFamily: "'Inter', system-ui", fontSize: 13 }}>Join now</button></>)}
            {view === 'signup' && (<>Already a nakama?{' '}<button onClick={() => { setView('signin'); reset(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38b6e0', fontWeight: 600, fontFamily: "'Inter', system-ui", fontSize: 13 }}>Sign in</button></>)}
            {view === 'forgot' && (<button onClick={() => { setView('signin'); reset(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38b6e0', fontWeight: 600, fontFamily: "'Inter', system-ui", fontSize: 13 }}>← Back to port</button>)}
          </div>
        </div>

      </div>
    </div>
  );
}
