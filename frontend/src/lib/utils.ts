import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number | undefined | null): string {
  const n = num ?? 0
  return new Intl.NumberFormat().format(n)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getBatchColor(batch: string): string {
  const colors: Record<string, string> = {
    'Summer 2026': '#FF6600',
    'Spring 2026': '#4CAF50',
    'Winter 2026': '#2196F3',
    'Fall 2025': '#FFC107',
  }
  return colors[batch] || '#9E9E9E'
}
