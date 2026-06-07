import clsx from 'clsx'

export default function StatCard({ title, value, subtitle, icon: Icon, accent, trend }) {
  return (
    <div role="group" aria-label={title} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
      {Icon && (
        <div className={clsx('p-2.5 rounded-lg flex-shrink-0', accent || 'bg-slate-100')}>
          <Icon size={20} className={clsx(accent ? 'text-white' : 'text-slate-500')} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate" title={title}>{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        {trend !== undefined && (
          <p className={clsx('text-xs font-medium mt-1', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
          </p>
        )}
      </div>
    </div>
  )
}
