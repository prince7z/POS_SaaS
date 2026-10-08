import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  badge?: string | number
  permissions?: string[]
  children?: NavItem[]
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export interface BreadcrumbItem {
  label: string
  path?: string
}
