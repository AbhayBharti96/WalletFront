import React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRightLeft,
  Ban,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  CircleX,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  Gift,
  Hand,
  IdCard,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Minus,
  Moon,
  Plus,
  Shield,
  Sparkles,
  Star,
  Sun,
  Search,
  Target,
  Users,
  Wallet,
} from 'lucide-react'

export type Icon8Name =
  | 'dashboard'
  | 'wallet'
  | 'transactions'
  | 'rewards'
  | 'kyc'
  | 'profile'
  | 'overview'
  | 'users'
  | 'review'
  | 'wave'
  | 'sun'
  | 'moon'
  | 'bell'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'eye'
  | 'eyeOff'
  | 'logout'
  | 'shield'
  | 'topup'
  | 'transfer'
  | 'withdraw'
  | 'target'
  | 'lock'
  | 'star'
  | 'clock'
  | 'calendar'
  | 'new'
  | 'blocked'
  | 'search'

const ICONS: Record<Icon8Name, LucideIcon> = {
  dashboard: LayoutDashboard,
  wallet: Wallet,
  transactions: ChartNoAxesCombined,
  rewards: Gift,
  kyc: IdCard,
  profile: CircleUserRound,
  overview: Building2,
  users: Users,
  review: ClipboardCheck,
  wave: Hand,
  sun: Sun,
  moon: Moon,
  bell: Bell,
  success: CircleCheck,
  error: CircleX,
  warning: CircleAlert,
  info: Info,
  eye: Eye,
  eyeOff: EyeOff,
  logout: LogOut,
  shield: Shield,
  topup: Plus,
  transfer: ArrowRightLeft,
  withdraw: Minus,
  target: Target,
  lock: Lock,
  star: Star,
  clock: Clock3,
  calendar: CalendarDays,
  new: Sparkles,
  blocked: Ban,
  search: Search,
}

interface Icon8Props {
  name: Icon8Name
  size?: number
  className?: string
  alt?: string
  color?: string
}

export const Icon8: React.FC<Icon8Props> = ({ name, size = 20, className, alt, color }) => {
  const Icon = ICONS[name]
  return (
    <Icon
      size={size}
      className={className}
      color={color}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      strokeWidth={2.25}
      absoluteStrokeWidth
    />
  )
}
