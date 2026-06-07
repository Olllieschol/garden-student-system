import clsx from 'clsx'

const CONFIG = {
  green: { label: 'Green', dot: 'bg-risk-green', text: 'text-risk-green', bg: 'bg-green-950/40 border border-risk-green/30' },
  amber: { label: 'Amber', dot: 'bg-risk-amber', text: 'text-risk-amber', bg: 'bg-amber-950/40 border border-risk-amber/30' },
  red:   { label: 'Red',   dot: 'bg-risk-red',   text: 'text-risk-red',   bg: 'bg-red-950/40 border border-risk-red/30' },
}

export default function RiskBadge({ level, label, size = 'sm' }) {
  const c = CONFIG[level] || CONFIG.green
  const small = size === 'sm'
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-medium', c.bg, c.text, small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm')}>
      <span className={clsx('rounded-full flex-shrink-0', c.dot, small ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {label || c.label}
    </span>
  )
}
