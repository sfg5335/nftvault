'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useCachedImage } from '../lib/imageCache'
import { Image as ImageIcon, AlertCircle } from 'lucide-react'

interface OptimizedImageProps {
  src?: string
  alt: string
  className?: string
  fallbackText?: string
  fallbackIcon?: React.ReactNode
  lazy?: boolean
  placeholder?: string
  aspectRatio?: 'square' | '16:9' | '4:3' | 'auto'
  onLoad?: () => void
  onError?: (error: string) => void
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  fallbackText,
  fallbackIcon,
  lazy = true,
  placeholder,
  aspectRatio = 'square',
  onLoad,
  onError
}: OptimizedImageProps) {
  const [isVisible, setIsVisible] = useState(!lazy)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)
  
  // Use cached image hook only when image should be visible
  const { src: cachedSrc, isLoading, error } = useCachedImage(isVisible ? src : undefined)

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || isVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px' // Start loading 50px before the image enters viewport
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, isVisible])

  // Handle image load/error
  useEffect(() => {
    if (error) {
      setImageError(true)
      onError?.(error)
    }
  }, [error, onError])

  const handleImageLoad = () => {
    setImageError(false)
    onLoad?.()
  }

  const handleImageError = () => {
    setImageError(true)
    onError?.('Failed to load image')
  }

  // Aspect ratio classes
  const aspectRatioClass = {
    'square': 'aspect-square',
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    'auto': ''
  }[aspectRatio]

  // Show loading state
  if (isVisible && isLoading && !imageError) {
    return (
      <div 
        ref={imgRef}
        className={`${className} ${aspectRatioClass} bg-white/5 flex items-center justify-center border border-white/10 rounded-lg overflow-hidden`}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          <span className="text-xs text-white/60">Loading...</span>
        </div>
      </div>
    )
  }

  // Show error state or fallback
  if (!src || imageError || error) {
    return (
      <div 
        ref={imgRef}
        className={`${className} ${aspectRatioClass} bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-white/10 rounded-lg overflow-hidden`}
      >
        <div className="flex flex-col items-center space-y-2 p-4 text-center">
          {fallbackIcon || <ImageIcon className="w-8 h-8 text-white/40" />}
          {fallbackText && (
            <span className="text-xs text-white/60 font-medium">
              {fallbackText}
            </span>
          )}
          {error && (
            <div className="flex items-center space-x-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" />
              <span>Failed to load</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show placeholder while waiting for lazy load
  if (!isVisible) {
    return (
      <div 
        ref={imgRef}
        className={`${className} ${aspectRatioClass} bg-white/5 border border-white/10 rounded-lg overflow-hidden`}
      >
        {placeholder && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-white/40">{placeholder}</span>
          </div>
        )}
      </div>
    )
  }

  // Show actual image
  return (
    <div 
      ref={imgRef}
      className={`${className} ${aspectRatioClass} relative overflow-hidden rounded-lg border border-white/10`}
    >
      <img
        src={cachedSrc}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-300"
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={lazy ? 'lazy' : 'eager'}
      />
      
      {/* Gradient overlay for better text readability if needed */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  )
}

// Specialized NFT Image component
export function NFTImage({
  nft,
  className,
  showName = false,
  aspectRatio = 'square',
  ...props
}: OptimizedImageProps & {
  nft?: { name?: string; symbol?: string; image?: string }
  showName?: boolean
}) {
  return (
    <div className="relative">
      <OptimizedImage
        src={nft?.image}
        alt={nft?.name || 'NFT'}
        className={className}
        fallbackText={nft?.symbol || 'NFT'}
        aspectRatio={aspectRatio}
        {...props}
      />
      
      {showName && nft?.name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="text-white text-xs font-medium truncate">
            {nft.name}
          </p>
          {nft.symbol && (
            <p className="text-white/60 text-xs truncate">
              {nft.symbol}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Skeleton loading component for consistent loading states
export function ImageSkeleton({ 
  className = '',
  aspectRatio = 'square',
  animate = true 
}: {
  className?: string
  aspectRatio?: 'square' | '16:9' | '4:3' | 'auto'
  animate?: boolean
}) {
  const aspectRatioClass = {
    'square': 'aspect-square',
    '16:9': 'aspect-video', 
    '4:3': 'aspect-[4/3]',
    'auto': ''
  }[aspectRatio]

  return (
    <div 
      className={`
        ${className} 
        ${aspectRatioClass} 
        bg-white/5 
        border 
        border-white/10 
        rounded-lg 
        overflow-hidden
        ${animate ? 'animate-pulse' : ''}
      `}
    >
      <div className="w-full h-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center">
        <ImageIcon className="w-8 h-8 text-white/20" />
      </div>
    </div>
  )
} 