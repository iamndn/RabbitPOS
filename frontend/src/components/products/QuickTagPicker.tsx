'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Plus, X } from 'lucide-react';
import { CustomTag, getTagBadgeStyle } from '@/components/products/TagManagerModal';

interface QuickTagPickerProps {
  currentTag?: string | null;
  locked?: boolean;
  tags: CustomTag[];
  customTags: CustomTag[];
  onSelect: (tagId: string) => void;
}

/**
 * One-click tag assignment. Shows the current badge (or an "add tag" button)
 * and opens a compact popover of all available tags to assign or remove.
 */
export default function QuickTagPicker({ currentTag, locked, tags, customTags, onSelect }: QuickTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasTag = !!currentTag && currentTag !== 'none';
  const style = hasTag ? getTagBadgeStyle(currentTag as string, customTags) : null;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = 224;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(r.bottom + 6, window.innerHeight - 300));
      setPos({ top, left });
    }
    setOpen((v) => !v);
  };

  const pick = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title="Gắn nhãn nhanh"
        className={
          hasTag && style
            ? `text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 cursor-pointer active:scale-95 transition ${style.badgeClasses}`
            : 'text-[10px] font-bold px-2 py-0.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 inline-flex items-center gap-1 cursor-pointer active:scale-95 transition'
        }
      >
        {hasTag && style ? (
          <>
            <span>{style.icon}</span>
            <span>{style.name}</span>
            {locked && <Lock className="w-2.5 h-2.5 text-amber-500" />}
          </>
        ) : (
          <>
            <Plus className="w-2.5 h-2.5 shrink-0" />
            <span>Nhãn</span>
          </>
        )}
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[80] w-56 max-h-[60vh] overflow-y-auto bg-white text-slate-800 border border-slate-200 shadow-2xl rounded-2xl p-1.5 space-y-0.5 animate-scaleIn"
        >
          {tags.map((tg) => {
            const s = getTagBadgeStyle(tg.id, customTags);
            const selected = currentTag === tg.id;
            return (
              <button
                key={tg.id}
                type="button"
                onClick={() => pick(tg.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-left cursor-pointer transition ${
                  selected ? 'bg-purple-50 font-bold' : 'hover:bg-purple-50/70 font-semibold'
                }`}
              >
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] uppercase font-extrabold ${s.badgeClasses}`}>
                  <span>{s.icon}</span>
                  <span>{s.name}</span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 text-purple-700 ml-auto" />}
              </button>
            );
          })}
          {hasTag && (
            <button
              type="button"
              onClick={() => pick('none')}
              className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 border-t border-slate-100 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Bỏ nhãn</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
