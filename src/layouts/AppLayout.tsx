import React, { useState, useCallback, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppDispatch, useTheme, useAuth, useClickOutside, useAppSelector } from '../shared/hooks'
import { markAllRead, markRead, clearAll } from '../store/notificationSlice'
import { timeAgo } from '../shared/utils'
import { Icon8 } from '../shared/components/Icon8'
import { ConfirmDialog } from '../shared/components/ui'

interface NavItem {
  to: string
  icon: React.ComponentProps<typeof Icon8>['name']
  label: string
  exact?: boolean
  darkAccent?: string
}

const userNav: NavItem[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', exact: true, darkAccent: '#22c55e' },
  { to: '/wallet', icon: 'wallet', label: 'Wallet', darkAccent: '#06b6d4' },
  { to: '/transactions', icon: 'transactions', label: 'Transactions', darkAccent: '#6366f1' },
  { to: '/rewards', icon: 'rewards', label: 'Rewards', darkAccent: '#f59e0b' },
  { to: '/kyc', icon: 'kyc', label: 'KYC', darkAccent: '#ec4899' },
  { to: '/profile', icon: 'profile', label: 'Profile', darkAccent: '#a855f7' },
]
const adminNav: NavItem[] = [
  { to: '/admin', icon: 'overview', label: 'Overview', exact: true, darkAccent: '#6366f1' },
  { to: '/admin/users', icon: 'users', label: 'Users', darkAccent: '#8b5cf6' },
  { to: '/admin/kyc', icon: 'review', label: 'KYC Review', darkAccent: '#3b82f6' },
  { to: '/admin/catalog', icon: 'rewards', label: 'Catalog', darkAccent: '#f59e0b' },
]
const adminWalletNav: NavItem[] = [
  { to: '/wallet', icon: 'wallet', label: 'Wallet', darkAccent: '#06b6d4' },
  { to: '/transactions', icon: 'transactions', label: 'Transactions', darkAccent: '#6366f1' },
  { to: '/rewards', icon: 'rewards', label: 'Rewards', darkAccent: '#f59e0b' },
  { to: '/profile', icon: 'profile', label: 'Profile', darkAccent: '#a855f7' },
]

const NavItem: React.FC<{ item: NavItem; isDark: boolean; accent?: string; onClick?: () => void }> = ({ item, isDark, accent = '#22c55e', onClick }) => (
  <NavLink
    to={item.to}
    end={item.exact}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${isActive ? 'text-white' : ''}`
    }
    style={({ isActive }) => ({
      background: isActive
        ? (isDark
          ? `linear-gradient(135deg, ${item.darkAccent || accent}, ${(item.darkAccent || accent)}cc)`
          : `linear-gradient(135deg, ${accent}, ${accent}cc)`)
        : 'transparent',
      color: isActive ? '#fff' : 'var(--text-secondary)',
      boxShadow: isActive
        ? (isDark
          ? `0 4px 14px ${(item.darkAccent || accent)}40`
          : `0 4px 14px ${accent}40`)
        : 'none',
    })}
    aria-current={undefined}
  >
    {({ isActive }) => (
      <>
        <span
          className={`${isDark ? 'w-8 h-8 rounded-xl' : 'w-5 h-5 rounded-none'} flex items-center justify-center transition-all duration-200`}
          style={{
            background: (isDark && isActive) ? 'rgba(255,255,255,0.16)' : 'transparent',
            boxShadow: (isDark && isActive) ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
          }}
          aria-hidden="true"
        >
          <Icon8 name={item.icon} size={18} />
        </span>
        <span>{item.label}</span>
      </>
    )}
  </NavLink>
)

export default function AppLayout() {
  const { isDark, toggle } = useTheme()
  const { user, logout } = useAuth()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items: notifications, unreadCount } = useAppSelector(s => s.notifications)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const notifRef  = useClickOutside(useCallback(() => setNotifOpen(false), []))
  const menuRef   = useClickOutside(useCallback(() => setMenuOpen(false), []))

  const isAdmin = user?.role === 'ADMIN'
  const initial = (user?.fullName?.[0] || user?.email?.[0] || 'U').toUpperCase()
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setProfilePhoto(null)
      return
    }
    const syncPhoto = () => {
      const cached = localStorage.getItem(`payvault-profile-photo:${user.id}`)
      setProfilePhoto(cached || null)
    }
    syncPhoto()
    window.addEventListener('payvault-profile-photo-updated', syncPhoto)
    return () => window.removeEventListener('payvault-profile-photo-updated', syncPhoto)
  }, [user?.id])

  const requestLogout = () => {
    setMenuOpen(false)
    setSidebarOpen(false)
    setLogoutConfirmOpen(true)
  }

  const confirmLogout = () => {
    setLogoutConfirmOpen(false)
    logout()
  }

  const SidebarInner = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>P</div>
        <div>
          <div className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>PayVault</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Digital Wallet</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {isAdmin ? (
          <>
            <div className="px-3 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Admin panel</span>
            </div>
            {adminNav.map(item => <NavItem key={item.to} item={item} isDark={isDark} accent="#6366f1" onClick={onNav} />)}
            <div className="px-3 pt-5 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Wallet</span>
            </div>
            {adminWalletNav.map(item => <NavItem key={item.to} item={item} isDark={isDark} onClick={onNav} />)}
          </>
        ) : (
          userNav.map(item => <NavItem key={item.to} item={item} isDark={isDark} onClick={onNav} />)
        )}
      </nav>

      {/* User chip */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#22c55e,#6366f1)' }}>
            {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.fullName || 'User'}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.role}</div>
          </div>
        </div>
        <button
          onClick={() => {
            onNav?.()
            requestLogout()
          }}
          className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--danger)' }}
          aria-label="Sign out"
        >
          <Icon8 name="logout" size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r"
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
        aria-label="Sidebar">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)} aria-hidden="true" />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col lg:hidden"
              style={{ background: 'var(--bg-sidebar)' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              aria-label="Mobile navigation">
              <SidebarInner onNav={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 lg:px-5 py-3 border-b flex-shrink-0"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg" onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu" style={{ color: 'var(--text-secondary)' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Welcome back, {user?.fullName?.split(' ')[0] || 'there'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all hover:scale-105 sm:px-3"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <Icon8 name={isDark ? 'sun' : 'moon'} size={18} />
              <span className="hidden sm:inline">{isDark ? 'Dark' : 'Light'}</span>
            </button>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(p => !p)} aria-label={`Notifications, ${unreadCount} unread`}
                aria-haspopup="true" aria-expanded={notifOpen}
                className="relative p-2 rounded-xl transition-all hover:scale-105"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center badge-pulse"
                    style={{ background: '#ef4444', fontSize: '9px', fontWeight: 700 }} aria-hidden="true">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-2xl shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    role="menu" aria-label="Notifications"
                  >
                    <div className="flex flex-col gap-2 px-4 py-3 border-b sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button onClick={() => dispatch(markAllRead())} className="text-xs font-medium"
                            style={{ color: 'var(--brand)' }} aria-label="Mark all notifications as read">
                            Mark all read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={() => dispatch(clearAll())} className="text-xs font-medium"
                            style={{ color: 'var(--danger)' }} aria-label="Clear notification tray">
                            Clear tray
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto" role="list">
                      {notifications.length === 0
                        ? (
                          <div className="py-8 text-center">
                            <div className="mb-2 inline-flex"><Icon8 name="bell" size={28} /></div>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                          </div>
                        )
                        : notifications.map(n => (
                          <button key={n.id} role="menuitem"
                            onClick={() => dispatch(markRead(n.id))}
                            className="w-full text-left flex gap-3 px-4 py-3 border-b transition-opacity hover:opacity-80"
                            style={{ borderColor: 'var(--border)', background: n.read ? 'transparent' : 'var(--bg-primary)' }}>
                            <span className="mt-0.5 inline-flex" aria-hidden="true">
                              <Icon8
                                name={n.type === 'success' ? 'success' : n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : 'info'}
                                size={18}
                              />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                              <p className="text-xs line-clamp-2 mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.time)}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: 'var(--brand)' }} aria-hidden="true" />}
                          </button>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(p => !p)} aria-haspopup="true" aria-expanded={menuOpen}
                aria-label="User menu"
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#6366f1)' }}>
                  {profilePhoto ? <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" /> : initial}
                </div>
                <span className="hidden sm:block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user?.fullName?.split(' ')[0] || 'User'}
                </span>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl py-1 shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }} role="menu">
                    {([{ label: 'Profile', icon: 'profile', to: '/profile' }, { label: 'KYC Status', icon: 'kyc', to: '/kyc' }] as const).map(item => (
                      <button key={item.to} role="menuitem"
                        onClick={() => { navigate(item.to); setMenuOpen(false) }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--text-primary)' }}>
                        <span aria-hidden="true"><Icon8 name={item.icon} size={16} /></span>{item.label}
                      </button>
                    ))}
                    <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                    <button role="menuitem" onClick={requestLogout}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--danger)' }}>
                      <span aria-hidden="true"><Icon8 name="logout" size={16} /></span>Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto focus:outline-none" id="main-content" tabIndex={-1}>
          <div className="page-enter"><Outlet /></div>
        </main>
      </div>
      <ConfirmDialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title="Sign out?"
        message="Are you sure you want to sign out of PayVault?"
        note="You can sign in again anytime."
        confirmLabel="Sign Out"
        danger
      />
    </div>
  )
}
