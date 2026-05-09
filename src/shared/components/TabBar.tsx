'use client'

interface TabItem<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
  badge?: string | number
  disabled?: boolean
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function TabBar<T extends string>({ tabs, active, onChange, className }: TabBarProps<T>) {
  return (
    <div className={`flex items-center gap-0.5 border-b border-border bg-muted/30 px-3 shrink-0 ${className ?? ''}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => !t.disabled && onChange(t.id)}
          disabled={t.disabled}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap relative ${
            active === t.id
              ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t'
              : t.disabled
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          {t.icon}
          {t.label}
          {t.badge !== undefined && t.badge !== '' && (
            <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 leading-5">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
