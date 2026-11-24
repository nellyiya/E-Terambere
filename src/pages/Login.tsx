
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, HardHat, Lock, Mail, ArrowRight } from 'lucide-react'
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
      <aside className="gloss dots relative hidden overflow-hidden bg-linear-to-br from-[#034337] to-[#0a5748] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <span className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-3 text-lg font-semibold tracking-wide">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <HardHat size={22} />
          </span>
          E-terambere
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">
            Manage projects. Monitor progress. Stay in control.
          </h1>
          <p className="mt-4 text-white/85">
            Oversee construction projects, manage supervisors, review daily site reports, and track project progress and costs from one central dashboard.
          </p>
        </div>

        <p className="relative text-xs text-white/70">
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
