'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Crop,
  Move,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface ImageCropModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number; // default 1 (1:1)
  cropOutputSize?: number; // default 600px
}

export default function ImageCropModal({
  isOpen,
  imageFile,
  onClose,
  onCropComplete,
  aspectRatio = 1,
  cropOutputSize = 600,
}: ImageCropModalProps) {
  const { t } = useTranslation();

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartDistRef = useRef<number | null>(null);

  // Load File to HTMLImageElement
  useEffect(() => {
    if (!imageFile) {
      setLoadedImg(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImg(img);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  // Render to Live Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outW = cropOutputSize;
    const outH = Math.round(cropOutputSize / aspectRatio);

    canvas.width = outW;
    canvas.height = outH;

    // Fill dark background in case user zooms out past edges
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Move origin to center of canvas
    ctx.translate(outW / 2, outH / 2);

    // Apply pan offset in canvas coordinate space
    const screenWidth = containerRef.current?.clientWidth || 288;
    const scaleToCanvas = outW / screenWidth;
    ctx.translate(offset.x * scaleToCanvas, offset.y * scaleToCanvas);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Compute base cover scale to fit 1:1 nicely
    const baseScale = Math.max(outW / loadedImg.naturalWidth, outH / loadedImg.naturalHeight);
    const effectiveScale = baseScale * zoom;

    ctx.scale(effectiveScale, effectiveScale);

    // Draw image centered at origin
    ctx.drawImage(
      loadedImg,
      -loadedImg.naturalWidth / 2,
      -loadedImg.naturalHeight / 2,
      loadedImg.naturalWidth,
      loadedImg.naturalHeight
    );

    ctx.restore();
  }, [loadedImg, zoom, rotation, offset, cropOutputSize, aspectRatio]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag & pinch to zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      setZoom((prev) => Math.min(3, Math.max(0.5, Number((prev * factor).toFixed(2)))));
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDistRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(3, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Final Crop Export directly from the rendered Canvas!
  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    setIsProcessing(true);

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false);
            return;
          }
          const baseName = imageFile?.name
            ? imageFile.name.replace(/\.[^/.]+$/, '')
            : 'cropped-image';
          const croppedFile = new File([blob], `${baseName}-1x1.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          onCropComplete(croppedFile);
          setIsProcessing(false);
          onClose();
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Failed to export cropped image:', err);
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageFile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">
                {t('products.crop_image_title') || 'Cắt ảnh theo khung 1:1'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('products.crop_image_subtitle') || 'Kéo để căn chỉnh và zoom theo khung vuông 1:1'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Crop Window with LIVE CANVAS */}
        <div className="relative p-6 flex items-center justify-center bg-slate-950 select-none overflow-hidden">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/80 cursor-grab active:cursor-grabbing bg-slate-900 flex items-center justify-center"
          >
            {/* The Live Render Canvas: What you see is 100% what you get */}
            <canvas
              ref={canvasRef}
              className="w-full h-full object-cover block pointer-events-none"
            />

            {/* Rule of Thirds Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>

            {/* 1:1 Badge Indicator */}
            <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30 flex items-center gap-1 pointer-events-none">
              <Crop className="w-3 h-3" /> 1:1
            </div>

            {/* Move Hint */}
            <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-[10px] text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1 pointer-events-none">
              <Move className="w-3 h-3 text-slate-400" /> Kéo để chỉnh
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 space-y-3">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" /> Xoay 90°
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Mặc định
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                {t('common.cancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleCrop}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {t('products.crop_confirm') || 'Cắt & Tải lên'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
