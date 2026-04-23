import { useState, useEffect, FormEvent, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useNotify } from '../../shared/hooks'
import { kycService, userService } from '../../core/api'
import { getApiErrorMessage } from '../../shared/apiErrors'
import { formatDate, getKycInfo } from '../../shared/utils'
import type { UserProfile } from '../../types'
import { updateKycStatus } from '../../store/authSlice'

const profilePhotoKey = (userId?: number) => `payvault-profile-photo:${userId ?? 'anon'}`

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read selected image'))
    reader.readAsDataURL(file)
  })

export function ProfilePage() {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(s => s.auth)
  const notify = useNotify()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    const cachedPhoto = localStorage.getItem(profilePhotoKey(user.id))
    setPhotoDataUrl(cachedPhoto || null)
    void load()
  }, [user?.id])

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: profileResp }, { data: kycResp }] = await Promise.all([
        userService.getProfile(user!.id),
        kycService.status(user!.id),
      ])

      const liveKyc = kycResp?.data?.status
      const mergedProfile: UserProfile = {
        ...profileResp.data,
        kycStatus: liveKyc ?? profileResp.data.kycStatus ?? user?.kycStatus,
      }

      setProfile(mergedProfile)
      setForm({ name: mergedProfile.fullName || '', phone: mergedProfile.phone || '' })

      if (liveKyc && liveKyc !== user?.kycStatus) {
        dispatch(updateKycStatus(liveKyc))
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load your profile right now.'))
    } finally {
      setLoading(false)
    }
  }

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, WEBP).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be up to 2MB.')
      return
    }

    try {
      const url = await fileToDataUrl(file)
      setPhotoDataUrl(url)
      localStorage.setItem(profilePhotoKey(user.id), url)
      window.dispatchEvent(new Event('payvault-profile-photo-updated'))
      toast.success('Profile photo updated.')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update profile photo.'))
    } finally {
      e.target.value = ''
    }
  }

  const removePhoto = () => {
    if (!user?.id) return
    localStorage.removeItem(profilePhotoKey(user.id))
    setPhotoDataUrl(null)
    window.dispatchEvent(new Event('payvault-profile-photo-updated'))
    toast.success('Profile photo removed.')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedName = form.name.trim()
    const normalizedPhone = form.phone.replace(/\D/g, '')
    if (trimmedName.length < 2) {
      toast.error('Please enter a valid full name.')
      return
    }
    if (normalizedPhone && !/^[0-9]{10}$/.test(normalizedPhone)) {
      toast.error('Phone number must be exactly 10 digits.')
      return
    }

    setSaving(true)
    try {
      const { data } = await userService.updateProfile(user!.id, { name: trimmedName, phone: normalizedPhone })
      setProfile(data.data)
      setForm({ name: data.data.fullName || '', phone: data.data.phone || '' })
      setEditing(false)
      notify('success', 'Profile Updated', 'Your profile details were updated successfully.')
      toast.success('Profile saved.')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save profile changes.'))
    } finally {
      setSaving(false)
    }
  }

  const p = profile || user
  const effectiveKycStatus = user?.kycStatus ?? p?.kycStatus
  const kycI = getKycInfo(effectiveKycStatus)
  const KycIcon = kycI.icon
  const initial = (p?.fullName?.[0] || 'U').toUpperCase()

  if (loading) {
    return (
      <div className="p-6 flex justify-center h-64 items-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div><h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>My Profile</h1></div>

      <motion.div className="card p-6 flex items-center gap-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#22c55e,#6366f1)' }} aria-hidden="true">
            {photoDataUrl
              ? <img src={photoDataUrl} alt="Profile" className="w-full h-full object-cover" />
              : initial}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-semibold" style={{ color: 'var(--brand)' }}>
            Upload Photo
          </button>
          {photoDataUrl && (
            <button type="button" onClick={removePhoto} className="text-[11px] font-semibold" style={{ color: 'var(--danger)' }}>
              Remove
            </button>
          )}
        </div>

        <div className="flex-1">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{p?.fullName || 'User'}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p?.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>{user?.role}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{ background: kycI.bg, color: kycI.color }}>
              <KycIcon fontSize="inherit" /> {effectiveKycStatus}
            </span>
          </div>
        </div>
        <button onClick={() => setEditing(!editing)} className="btn-secondary py-2 px-4 text-xs">{editing ? 'Cancel' : 'Edit'}</button>
      </motion.div>

      {editing && (
        <motion.div className="card p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <label htmlFor="pname" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
              <input id="pname" type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" minLength={2} maxLength={100} />
            </div>
            <div>
              <label htmlFor="pphone" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
              <input id="pphone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-field" maxLength={10} placeholder="10 digit number" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary py-2.5 text-sm">{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </motion.div>
      )}

      <motion.div className="card p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Account Information</h3>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {[['Email', p?.email], ['Phone', p?.phone || '-'], ['Status', p?.status || 'ACTIVE'], ['KYC', effectiveKycStatus], ['Member Since', formatDate(p?.createdAt, 'DD MMM YYYY')], ['User ID', `#${user?.id}`]]
            .map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                <dd className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{v}</dd>
              </div>
            ))}
        </dl>
      </motion.div>
    </div>
  )
}

export default ProfilePage
