'use client'

import React from 'react'
import { clsx } from 'clsx'

// Button variant styles
const buttonVariants = {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary", 
    muted: "bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-muted",
    ghost: "hover:bg-muted focus:ring-muted",
    outline: "border border-border bg-transparent hover:bg-muted focus:ring-border",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500",
    glass: "bg-black/50 text-white hover:bg-black/70 focus:ring-gray-500",
    glassActive: "bg-primary/50 text-white hover:bg-primary/70 focus:ring-primary"
  },
  size: {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10 p-0",
    iconSm: "h-8 w-8 p-0", 
    iconLg: "h-12 w-12 p-0"
  }
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants.variant
  size?: keyof typeof buttonVariants.size
  fullWidth?: boolean
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', fullWidth, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button'
    return (
      <Comp
        className={clsx(
          // Base styles
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          // Variant styles
          buttonVariants.variant[variant],
          // Size styles
          buttonVariants.size[size],
          // Full width
          fullWidth && "w-full",
          // Custom className
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Icon button with tooltip support
export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ComponentType<{ className?: string }>
  tooltip?: string
  active?: boolean
  badge?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, tooltip, active, badge, variant, className, ...props }, ref) => {
    const buttonVariant = active 
      ? variant === 'glass' ? 'glassActive' : 'default'
      : variant || 'ghost'
    
    return (
      <Button
        ref={ref}
        variant={buttonVariant}
        size="icon"
        className={clsx("relative", className)}
        title={tooltip}
        {...props}
      >
        <Icon className="w-4 h-4" />
        {badge && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-current animate-pulse" />
        )}
      </Button>
    )
  }
)
IconButton.displayName = "IconButton"

// Loading button with spinner
export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
  icon?: React.ComponentType<{ className?: string }>
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingText, icon: Icon, children, disabled, ...props }, ref) => {
    return (
      <Button 
        ref={ref}
        disabled={loading || disabled}
        {...props}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
            {loadingText || 'Loading...'}
          </>
        ) : (
          <>
            {Icon && <Icon className="w-4 h-4 mr-2" />}
            {children}
          </>
        )}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"