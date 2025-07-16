'use client'

import React from 'react'
import { Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  color?: 'primary' | 'secondary' | 'white'
}

export function LoadingSpinner({ size = 'md', className = '', color = 'primary' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const colorClasses = {
    primary: 'text-blue-400',
    secondary: 'text-purple-400',
    white: 'text-white'
  }

  return (
    <Loader2 className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin ${className}`} />
  )
}

interface CenteredLoadingProps {
  title?: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CenteredLoading({ 
  title = 'Loading...', 
  subtitle, 
  size = 'md',
  className = ''
}: CenteredLoadingProps) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="flex flex-col items-center space-y-3">
        <LoadingSpinner size={size} />
        <div className="text-center">
          <p className="text-white/70 font-medium">{title}</p>
          {subtitle && (
            <p className="text-white/50 text-sm mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProgressLoadingProps {
  title: string
  current: number
  total: number
  subtitle?: string
  className?: string
}

export function ProgressLoading({ 
  title, 
  current, 
  total, 
  subtitle,
  className = ''
}: ProgressLoadingProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div className={`flex flex-col items-center space-y-4 py-8 ${className}`}>
      <LoadingSpinner size="lg" />
      <div className="text-center">
        <p className="text-white/70 font-medium">{title}</p>
        {subtitle && (
          <p className="text-white/50 text-sm mt-1">{subtitle}</p>
        )}
        <div className="mt-3">
          <p className="text-white/40 text-sm">
            {current} / {total} completed
          </p>
          <div className="w-48 bg-white/10 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ErrorStateProps {
  title: string
  subtitle?: string
  onRetry?: () => void
  retryText?: string
  className?: string
}

export function ErrorState({ 
  title, 
  subtitle, 
  onRetry, 
  retryText = 'Try again',
  className = ''
}: ErrorStateProps) {
  return (
    <div className={`bg-red-500/10 border border-red-500/20 rounded-lg p-6 ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-red-400 font-medium">{title}</p>
          {subtitle && (
            <p className="text-red-300/80 text-sm mt-1">{subtitle}</p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline transition-colors"
            >
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ 
  title, 
  subtitle, 
  icon, 
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`bg-white/5 rounded-lg p-8 text-center border border-white/10 ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        {icon && (
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <p className="text-white/60 font-medium">{title}</p>
          {subtitle && (
            <p className="text-white/40 text-sm mt-1">{subtitle}</p>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

interface ConnectionIndicatorProps {
  isConnected: boolean
  className?: string
}

export function ConnectionIndicator({ isConnected, className = '' }: ConnectionIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">Disconnected</span>
        </>
      )}
    </div>
  )
}

// Button loading states
interface LoadingButtonProps {
  children: React.ReactNode
  loading?: boolean
  loadingText?: string
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

export function LoadingButton({
  children,
  loading = false,
  loadingText,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick
}: LoadingButtonProps) {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed'
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white hover:shadow-lg hover:shadow-blue-500/25',
    secondary: 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white hover:shadow-lg hover:shadow-purple-500/25',
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white hover:shadow-lg hover:shadow-red-500/25'
  }

  const sizeClasses = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-3 px-4',
    lg: 'py-4 px-6 text-lg'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" color="white" />
          <span>{loadingText || 'Loading...'}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
} 