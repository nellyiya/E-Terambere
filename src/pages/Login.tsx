
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ArrowRight, HardHat } from 'lucide-react'
import { errMsg } from '../lib/api'
import { getToken } from '../lib/auth'
import { emailOk } from '../lib/password'
import { login } from '../services/authApi'

const GRAD = 'linear-gradient(145deg, #2fae9d 0%, #1c8578 52%, #0f4a43 100%)'

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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-[#022b23] via-[#034337] to-[#0a5748] p-14 text-white lg:flex">
        <style>{`
          @keyframes sway { from { transform: translate3d(0,0,0) rotate(var(--r,0deg)) } to { transform: translate3d(18px,-14px,0) rotate(var(--r,0deg)) } }
          .sway { animation: sway 12s ease-in-out infinite alternate }
          @media (prefers-reduced-motion: reduce) { .sway { animation: none } }
        `}</style>

        {/* background shapes */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-teal-300/10 blur-3xl" />
          <div className="absolute left-[18%] top-0 h-40 w-3 rounded-full bg-white/10" />
          <div className="absolute left-[18%] top-0 ml-6 h-40 w-3 rounded-full bg-white/10" />
          <div className="sway absolute -right-20 top-[30%] h-64 w-64 rounded-full border-[16px] border-white/[0.07]" />
          <div style={{ '--r': '-38deg' } as React.CSSProperties} className="sway absolute -right-24 top-[52%] h-32 w-[28rem] rounded-full bg-linear-to-r from-emerald-300/30 to-teal-200/5" />
          <div style={{ '--r': '-38deg' } as React.CSSProperties} className="sway absolute -left-10 top-[36%] h-14 w-[16rem] rounded-full bg-white/[0.06]" />
        </div>

        {/* brand */}
        <div className="relative z-10 flex items-center gap-3">
          <span style={{ background: GRAD }} className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg shadow-black/20 ring-2 ring-white/80"><HardHat size={22} /></span>
          <span className="text-lg font-semibold">E-terambere</span>
        </div>

        {/* message */}
        <div className="relative z-10">
          <h1 className="max-w-lg text-balance text-6xl font-bold leading-[1.05] tracking-tight">
            Build. Manage. Grow together.
          </h1>
          <div className="mt-8 h-0.5 w-16 rounded-full bg-white/50" />
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
            Follow every site, report and cost of your construction projects from one clean place.
          </p>
          <p className="mt-12 text-xs text-white/40">E-Terambere · Workforce &amp; Project Management</p>
        </div>
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
