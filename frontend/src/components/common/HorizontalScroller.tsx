'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDragScroll } from '@/hooks/useDragScroll';

interface HorizontalScrollerProps {
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  showArrows?: boolean;
  arrowSize?: 'sm' | 'md';
  scrollAmount?: number;
  customScrollbar?: boolean;
  gradientFade?: boolean;
}

export default function HorizontalScroller({
  children,
  className = '',
  wrapperClassName = '',
  showArrows = true,
  arrowSize = 'sm',
  scrollAmount = 200,
  customScrollbar = true,
  gradientFade = true,
}: HorizontalScrollerProps) {
  const { ref, isDragging, canScrollLeft, canScrollRight, scrollLeft, scrollRight } =
    useDragScroll<HTMLDivElement>({ speed: 1.2, dragThreshold: 5 });

  const arrowBtnClasses =
    arrowSize === 'sm'
      ? 'w-6 h-6 p-1 text-slate-700 bg-white/95 hover:bg-slate-50 border border-slate-200/90 shadow-sm rounded-full'
      : 'w-7 h-7 p-1.5 text-slate-700 bg-white/95 hover:bg-slate-50 border border-slate-200/90 shadow-sm rounded-full';

  return (
    <div className={`relative flex items-center group w-full min-w-0 ${wrapperClassName}`}>
      {/* Left Navigation Arrow */}
      {showArrows && canScrollLeft && (
        <div className="absolute left-0 z-10 flex items-center h-full pr-2">
          {gradientFade && (
            <div className="absolute left-0 inset-y-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              scrollLeft(scrollAmount);
            }}
            className={`relative z-10 transition-transform active:scale-90 flex items-center justify-center cursor-pointer ${arrowBtnClasses}`}
            title="Cuộn sang trái"
            aria-label="Cuộn sang trái"
          >
            <ChevronLeft className="w-full h-full" />
          </button>
        </div>
      )}

      {/* Main Scrollable Viewport */}
      <div
        ref={ref}
        className={`w-full min-w-0 overflow-x-auto flex items-center ${
          customScrollbar ? 'custom-scrollbar' : 'no-scrollbar'
        } ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'} ${className}`}
      >
        {children}
      </div>

      {/* Right Navigation Arrow */}
      {showArrows && canScrollRight && (
        <div className="absolute right-0 z-10 flex items-center h-full pl-2">
          {gradientFade && (
            <div className="absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              scrollRight(scrollAmount);
            }}
            className={`relative z-10 transition-transform active:scale-90 flex items-center justify-center cursor-pointer ${arrowBtnClasses}`}
            title="Cuộn sang phải"
            aria-label="Cuộn sang phải"
          >
            <ChevronRight className="w-full h-full" />
          </button>
        </div>
      )}
    </div>
  );
}
