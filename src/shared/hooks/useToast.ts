'use client'

import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  push: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

let seq = 0
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = String(++seq)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    const timer = setTimeout(() => {
      timers.delete(id)
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3500)
    timers.set(id, timer)
  },
  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function useToast() {
  return useToastStore((s) => s.push)
}
