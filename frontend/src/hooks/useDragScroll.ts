'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseDragScrollOptions {
  /** Speed multiplier for dragging, default is 1.0 */
  speed?: number;
  /** Distance threshold in px to consider a movement as drag (default 5px) */
  dragThreshold?: number;
}

export interface UseDragScrollReturn<T extends HTMLElement> {
  ref: React.RefObject<T>;
  isDragging: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollLeft: (amount?: number) => void;
  scrollRight: (amount?: number) => void;
  updateScrollState: () => void;
}

export function useDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseDragScrollOptions = {}
): UseDragScrollReturn<T> {
  const { speed = 1.0, dragThreshold = 5 } = options;
  const ref = useRef<T>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  const isDownRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startScrollLeftRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);

  const updateScrollState = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  const scrollLeftFn = useCallback((amount: number = 200) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: -amount, behavior: 'smooth' });
  }, []);

  const scrollRightFn = useCallback((amount: number = 200) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check initial scroll bounds
    updateScrollState();

    const handleScroll = () => {
      updateScrollState();
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only respond to main left click
      if (e.button !== 0) return;
      isDownRef.current = true;
      hasDraggedRef.current = false;
      startXRef.current = e.pageX - el.offsetLeft;
      startScrollLeftRef.current = el.scrollLeft;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDownRef.current) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startXRef.current) * speed;

      if (!hasDraggedRef.current && Math.abs(walk) > dragThreshold) {
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasDraggedRef.current) {
        e.preventDefault();
        el.scrollLeft = startScrollLeftRef.current - walk;
      }
    };

    const handleMouseUp = () => {
      if (isDownRef.current) {
        isDownRef.current = false;
        // Keep isDragging state briefly so onClick can check it, then reset
        setTimeout(() => {
          setIsDragging(false);
          hasDraggedRef.current = false;
        }, 50);
      }
    };

    const handleMouseLeave = () => {
      if (isDownRef.current) {
        isDownRef.current = false;
        setIsDragging(false);
        hasDraggedRef.current = false;
      }
    };

    // Capture click events if a drag occurred to prevent accidental button activation
    const handleClickCapture = (e: MouseEvent) => {
      if (hasDraggedRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('click', handleClickCapture, true);

    // Observe size changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState();
      });
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('click', handleClickCapture, true);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [speed, dragThreshold, updateScrollState]);

  return {
    ref,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollLeft: scrollLeftFn,
    scrollRight: scrollRightFn,
    updateScrollState,
  };
}
