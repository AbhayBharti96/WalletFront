import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authService } from '../../core/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { Icon8 } from '../../shared/components/Icon8'

type Step = 0 | 1 | 2

const getPasswordStrength = (password: string) => {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[@$!%*?&]/.test(password)) score += 1
  return score
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const strength = getPasswordStrength(newPassword)
  const strengthLabel = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'][strength]

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid email address')
      return
    }

    setLoading(true)
    try {
      await authService.forgotPasswordOtp(email.trim())
      toast.success('OTP sent to your email')
      setStep(1)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send OTP'))
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (otp.length < 4) {
      toast.error('Enter the OTP sent to your email')
      return
    }

    setLoading(true)
    try {
      const { data } = await authService.forgotPasswordVerify(email.trim(), otp)
      setResetToken(data.resetToken)
      toast.success('OTP verified')
      setStep(2)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invalid OTP'))
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
      toast.error('Use A-Z, a-z, 0-9 and @$!%*?& in password')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(resetToken, newPassword)
      toast.success('Password updated. Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Reset Password
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Recover access to your PayVault account
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.form
            key="forgot-step-0"
            onSubmit={sendOtp}
            className="space-y-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
              {loading ? 'Sending OTP...' : 'Send OTP ->'}
            </button>
          </motion.form>
        )}

        {step === 1 && (
          <motion.form
            key="forgot-step-1"
            onSubmit={verifyOtp}
            className="space-y-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            <div>
              <label
                htmlFor="otp"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                OTP Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="input-field text-center text-2xl font-mono tracking-[0.35em]"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
              {loading ? 'Verifying...' : 'Verify OTP ->'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => authService.forgotPasswordOtp(email.trim()).then(() => toast.success('OTP resent')).catch((err) => toast.error(getApiErrorMessage(err, 'Failed to resend OTP')))}
              className="w-full text-sm font-medium"
              style={{ color: 'var(--brand)' }}
            >
              Resend OTP
            </button>
          </motion.form>
        )}

        {step === 2 && (
          <motion.form
            key="forgot-step-2"
            onSubmit={resetPassword}
            className="space-y-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
          >
            <div>
              <label
                htmlFor="newPassword"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, A-Z, 0-9, @$!%"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? (
                    <Icon8 name="eyeOff" size={18} className="opacity-80" />
                  ) : (
                    <Icon8 name="eye" size={18} className="opacity-80" />
                  )}
                </button>
              </div>
              {newPassword && (
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
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm">
              {loading ? 'Resetting...' : 'Update Password ->'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>
        Back to login?{' '}
        <Link to="/login" className="font-semibold" style={{ color: 'var(--brand)' }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
