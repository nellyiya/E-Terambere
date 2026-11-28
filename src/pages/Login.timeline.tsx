
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { errMsg } from '../lib/api'
import { getToken } from '../lib/auth'
import { emailOk } from '../lib/password'
import { login } from '../services/authApi'

export default function Login() {
  const nav = useNavigate(), qc = useQueryClient(), [sp] = useSearchParams()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false), [touched, setTouched] = useState(false)

  const m = useMutation({
    mutationFn: () => login(email.trim(), pw),
    onSuccess: () => {
      qc.clear()
      nav(from, { replace: true })
    }
  })

  if (getToken()) return <Navigate to="/dashboard" replace />

  const emailErr = touched && !emailOk(email) ? 'Enter a complete email address, like name@company.com.' : ''
  const pwErr = touched && !pw ? 'Enter your password.' : ''

  const field = 'mt-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20'

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#022b23] p-14 text-white lg:flex">
        <style>{`
          @keyframes reveal { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
          @keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(110,231,183,.55) } 100% { box-shadow: 0 0 0 10px rgba(110,231,183,0) } }
          .bar-reveal { animation: reveal .9s cubic-bezier(.2,.8,.2,1) both }
          .today-dot { animation: pulseDot 2s ease-out infinite }
          @media (prefers-reduced-motion: reduce) { .bar-reveal, .today-dot { animation: none } }
        `}</style>

        {/* background: depth + glow */}
        <div aria-hidden className="absolute inset-0 bg-linear-to-br from-[#034337] via-[#022b23] to-[#011a15]" />
        <div aria-hidden className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-400/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-48 -left-32 h-[480px] w-[480px] rounded-full bg-emerald-300/10 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 75%)',
            maskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 75%)'
          }}
        />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300 text-[#022b23]">
            <LayoutDashboard size={20} />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/90">Project Management</span>
        </div>

        {/* Headline */}
        <div className="relative z-10 mt-12">
          <h1 className="max-w-lg text-balance text-5xl font-semibold leading-[1.08] tracking-tight">
            Run every project from one place.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-emerald-50/65">
            Plan the work, follow progress and keep every deadline in sight, without chasing updates.
          </p>
        </div>

        {/* Timeline board */}
        <div className="relative z-10 mt-12 mb-10 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Project timeline</p>
              <p className="text-xs text-emerald-50/55">Week 12</p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
              On schedule
            </span>
          </div>

          {/* day labels */}
          <div className="grid grid-cols-5 pb-3 text-center text-xs text-emerald-50/45">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
          </div>

          <div className="relative">
            {/* column lines */}
            <div aria-hidden className="absolute inset-0 grid grid-cols-5">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className="border-l border-white/10 last:border-r" />
              ))}
            </div>

            {/* today marker */}
            <div aria-hidden className="absolute -top-2 bottom-0 left-[45%] z-10 w-px bg-emerald-300">
              <span className="today-dot absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-300" />
            </div>

            <div className="relative space-y-3 py-1">
              <div className="grid h-10 grid-cols-10 items-center">
                <div
                  className="bar-reveal flex h-10 items-center rounded-full px-4 text-xs font-semibold bg-emerald-300 text-[#022b23]"
                  style={{ gridColumn: '1 / span 4', animationDelay: '0.35s' }}
                >
                  Planning
                </div>
              </div>
              <div className="grid h-10 grid-cols-10 items-center">
                <div
                  className="bar-reveal flex h-10 items-center rounded-full px-4 text-xs font-semibold bg-white text-[#022b23]"
                  style={{ gridColumn: '3 / span 5', animationDelay: '0.51s' }}
                >
                  Execution
                </div>
              </div>
              <div className="grid h-10 grid-cols-10 items-center">
                <div
                  className="bar-reveal flex h-10 items-center rounded-full px-4 text-xs font-semibold border border-white/15 bg-white/10 text-white/85"
                  style={{ gridColumn: '6 / span 3', animationDelay: '0.67s' }}
                >
                  Review
                </div>
              </div>
              <div className="grid h-10 grid-cols-10 items-center">
                <div
                  className="bar-reveal flex h-10 items-center rounded-full px-4 text-xs font-semibold border border-white/15 bg-white/10 text-white/85"
                  style={{ gridColumn: '9 / span 2', animationDelay: '0.83s' }}
                >
                  Delivery
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-xs text-emerald-50/60">
          <ShieldCheck size={14} className="text-emerald-300" />
          Administrator access only
        </p>
      </aside>

      <main className="grid place-items-center p-6">
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault()
            setTouched(true)
            if (emailOk(email) && pw) m.mutate()
          }}
          className="rise w-full max-w-sm"
        >
          {/* Premium Welcome Header */}
          <div className="relative mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-[#034337] to-[#0a5748] px-7 py-7 text-white shadow-lg">
            <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/5" />

            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span className="text-[10px] font-semibold tracking-[0.18em] text-white/90">
                  ADMINISTRATOR PORTAL
                </span>
              </div>

              <h2 className="text-3xl font-bold tracking-tight">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Sign in to access your project management dashboard.
              </p>

              <div className="mt-5 h-1 w-12 rounded-full bg-emerald-300/80" />
            </div>
          </div>

          {sp.get('expired') && (
            <p
              role="status"
              className="mb-5 rounded-xl bg-amber-100 p-3 text-sm text-amber-700"
            >
              Your session ended. Please sign in again.
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Email
            <div className={`${field} ${emailErr ? 'border-red-400' : 'border-slate-200'}`}>
              <Mail size={16} className="text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-transparent text-sm font-normal outline-none"
              />
            </div>
            {emailErr && (
              <p className="mt-1 text-xs text-red-600">{emailErr}</p>
            )}
          </label>

          <label className="mt-5 block text-sm font-medium text-slate-700">
            Password
            <div className={`${field} ${pwErr ? 'border-red-400' : 'border-slate-200'}`}>
              <Lock size={16} className="text-slate-400" />
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                className="w-full bg-transparent text-sm font-normal outline-none"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="text-slate-400 hover:text-brand"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwErr && (
              <p className="mt-1 text-xs text-red-600">{pwErr}</p>
            )}
          </label>

          {m.error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {errMsg(m.error)}
            </p>
          )}

          {/* Sign In Button */}
          <button
            disabled={m.isPending}
            className="mt-7 group flex w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-[#034337] to-[#0a5748] py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-60"
          >
            <span>{m.isPending ? 'Signing in…' : 'Sign in'}</span>
            {!m.isPending && (
              <ArrowRight
                size={18}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            )}
          </button>

          <p className="mt-6 text-center text-xs text-slate-500">
            Forgot your password? Contact your system administrator.
          </p>
        </form>
      </main>
    </div>
  )
}
