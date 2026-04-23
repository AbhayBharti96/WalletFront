import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from '../../shared/hooks'
import { signupUser, sendOtpThunk, verifyOtpThunk } from '../../store/authSlice'
import { addNotification } from '../../store/notificationSlice'
import { Icon8 } from '../../shared/components/Icon8'

type Step = 0 | 1
interface FormState { fullName: string; email: string; phone: string; password: string; confirm: string }
interface Errors { [k: string]: string }

const getPasswordStrength = (password: string) => {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[@$!%*?&]/.test(password)) score += 1
  return score
}

const validate = (f: FormState): Errors => {
  const e: Errors = {}
  if (!f.fullName.trim()) e.fullName = 'Full name is required'
  else if (f.fullName.trim().length < 2) e.fullName = 'At least 2 characters required'
  if (!f.email.trim()) e.email = 'Email address is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address'
  if (!f.phone.trim()) e.phone = 'Phone number is required'
  else if (!/^[0-9]{10}$/.test(f.phone)) e.phone = 'Phone number must be exactly 10 digits'
  if (!f.password) e.password = 'Password is required'
  else if (f.password.length < 8) e.password = 'Minimum 8 characters'
  else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(f.password)) {
    e.password = 'Must include A-Z, a-z, 0-9, and @$!%*?&'
  }
  if (!f.confirm) e.confirm = 'Confirm password is required'
  else if (f.password !== f.confirm) e.confirm = 'Passwords do not match'
  return e
}

const STEPS = ['Account', 'Verify Email']

export default function SignupPage() {
  const dispatch = useAppDispatch()
  const { loading } = useAppSelector(s => s.auth)
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const strength = getPasswordStrength(form.password)
  const strengthLabel = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'][strength]

  const setField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
    setForm(p => ({ ...p, [k]: nextValue }))
    setErrors(p => ({ ...p, [k]: '' }))
  }

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('Please fill all required fields')
      return
    }

    const email = form.email.trim()
    const res = await dispatch(signupUser({
      fullName: form.fullName.trim(),
      email,
      phone: form.phone,
      password: form.password,
    }))

    if (signupUser.fulfilled.match(res)) {
      setStep(1)
      setOtpSending(true)
      const otpRes = await dispatch(sendOtpThunk(email))
      setOtpSending(false)
      if (sendOtpThunk.rejected.match(otpRes)) {
        toast.error((otpRes.payload as string) || 'Account created, but OTP could not be sent. Please resend.')
        return
      }
      toast.success('OTP sent to your email')
    } else {
      toast.error((res.payload as string) || 'Signup failed')
    }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) {
      setOtpError('OTP is required')
      toast.error('Enter the OTP sent to your email')
      return
    }
    if (otp.length < 4) {
      setOtpError('Enter a valid OTP')
      toast.error('Enter a valid OTP')
      return
    }
    const res = await dispatch(verifyOtpThunk({ email: form.email.trim(), otp }))
    if (verifyOtpThunk.fulfilled.match(res)) {
      dispatch(addNotification({
        type: 'success',
        title: 'Welcome to PayVault!',
        message: `Signed in as ${res.payload.user.fullName}`,
      }))
      toast.success("Email verified. You're signed in.")
      navigate('/dashboard')
    } else {
      toast.error((res.payload as string) || 'Invalid OTP')
    }
  }

  const fields: Array<{ key: keyof FormState; label: string; type: string; placeholder: string; auto?: string }> = [
    { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'John Doe', auto: 'name' },
    { key: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', auto: 'email' },
    { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '9876543210', auto: 'tel' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Create Account</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Join PayVault today - it is free</p>
      </div>

      <div className="flex items-center mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={0} aria-valuemax={1} aria-label="Signup progress">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: i <= step ? 'var(--brand)' : 'var(--bg-primary)',
                  color: i <= step ? '#fff' : 'var(--text-muted)',
                  border: `2px solid ${i <= step ? 'var(--brand)' : 'var(--border)'}`,
                }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="hidden sm:block text-xs" style={{ color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px mx-2" style={{ background: i < step ? 'var(--brand)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.form key="s0" onSubmit={handleSignup} className="space-y-4" noValidate
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label htmlFor={f.key} className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                <input
                  id={f.key}
                  type={f.type}
                  placeholder={f.placeholder}
                  autoComplete={f.auto}
                  value={form[f.key]}
                  onChange={setField(f.key)}
                  className="input-field"
                  maxLength={f.key === 'phone' ? 10 : undefined}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors[f.key])}
                  aria-describedby={errors[f.key] ? `${f.key}-err` : undefined}
                />
                {errors[f.key] && <p id={`${f.key}-err`} className="text-xs mt-1" style={{ color: 'var(--danger)' }} role="alert">{errors[f.key]}</p>}
              </div>
            ))}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative">
                <input id="password" type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, A-Z, 0-9, @$!%"
                  autoComplete="new-password" value={form.password} onChange={setField('password')} className="input-field pr-10"
                  required aria-required="true" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-err' : undefined} />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={showPass ? 'Hide password' : 'Show password'} style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <Icon8 name="eyeOff" size={18} className="opacity-80" /> : <Icon8 name="eye" size={18} className="opacity-80" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1.5">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full"
                        style={{ background: i < strength ? strengthColor : 'var(--border)' }}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: strengthColor }}>
                    Strength: {strengthLabel}
                  </div>
                </div>
              )}
              {errors.password && <p id="password-err" className="text-xs mt-1" style={{ color: 'var(--danger)' }} role="alert">{errors.password}</p>}
            </div>
            <div>
              <label htmlFor="confirm" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
              <input id="confirm" type="password" placeholder="Repeat your password" autoComplete="new-password"
                value={form.confirm} onChange={setField('confirm')} className="input-field"
                required aria-required="true" aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'confirm-err' : undefined} />
              {errors.confirm && <p id="confirm-err" className="text-xs mt-1" style={{ color: 'var(--danger)' }} role="alert">{errors.confirm}</p>}
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
              {loading ? 'Creating account...' : 'Create Account ->'}
            </button>
            <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Already have an account? <Link to="/login" className="font-semibold" style={{ color: 'var(--brand)' }}>Sign in -&gt;</Link>
            </p>
          </motion.form>
        )}

        {step === 1 && (
          <motion.form key="s1" onSubmit={handleVerify} className="space-y-5"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="text-center py-4">
              <motion.div className="mb-3 inline-flex" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                <Icon8 name="info" size={42} />
              </motion.div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                We sent a code to<br /><strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>
              </p>
              {otpSending && (
                <p className="text-xs mt-2" style={{ color: 'var(--brand)' }} role="status">
                  Sending OTP...
                </p>
              )}
            </div>
            <div>
              <label htmlFor="otp" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>OTP Code</label>
              <input id="otp" type="text" inputMode="numeric" placeholder="Enter OTP" value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                className="input-field text-center text-3xl font-mono tracking-[0.4em]" maxLength={8} autoFocus
                required aria-required="true" aria-invalid={Boolean(otpError)} aria-describedby={otpError ? 'otp-err' : undefined} />
              {otpError && <p id="otp-err" className="text-xs mt-1 text-center" style={{ color: 'var(--danger)' }} role="alert">{otpError}</p>}
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
              {loading ? 'Verifying...' : 'Verify OTP ->'}
            </button>
            <div className="text-center">
              <button type="button" onClick={async () => {
                setOtpSending(true)
                const resendRes = await dispatch(sendOtpThunk(form.email.trim()))
                setOtpSending(false)
                if (sendOtpThunk.rejected.match(resendRes)) {
                  toast.error((resendRes.payload as string) || 'Could not resend OTP')
                  return
                }
                toast.success('OTP resent')
              }} className="text-sm" style={{ color: 'var(--brand)' }}>
                Resend OTP
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
