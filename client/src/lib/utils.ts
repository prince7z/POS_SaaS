import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a stable pseudo-random ID (not cryptographically secure).
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Clamps a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Capitalises the first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Replaces underscores and hyphens with spaces, then capitalises.
 */
export function humanize(str: string): string {
  return str.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Truncates a string to `maxLength` and appends an ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '…'
}
