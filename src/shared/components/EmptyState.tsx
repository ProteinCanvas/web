interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div className={`flex items-center justify-center h-full text-xs text-muted-foreground italic ${className ?? ''}`}>
      {message}
    </div>
  )
}
