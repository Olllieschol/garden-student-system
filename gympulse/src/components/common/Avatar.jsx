import clsx from 'clsx'

const COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
]

function colorFor(name) {
  let hash = 0
  for (const ch of (name || '')) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Avatar({ name, size = 'md' }) {
  const sizeClass = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size]
  return (
    <div className={clsx('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0', colorFor(name), sizeClass)}>
      {initials(name)}
    </div>
  )
}
