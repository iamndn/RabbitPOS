import { notFound } from 'next/navigation';
import UiGalleryClient from './UiGalleryClient';

/**
 * Isolated Tahoe ("Liquid Glass") Specimen & Verification Gallery (`Override Q7` & `G1-D3 (a)`):
 * - Excluded from production builds (`NODE_ENV === 'production'`) and whenever
 *   `NEXT_PUBLIC_ENABLE_UI_GALLERY !== 'true'`.
 * - Enforces client-side `isAuthenticated() && isAdmin()` guard inside `UiGalleryClient`.
 * - Absent from navigation; fires zero backend API requests; deleted in Phase T6.
 */
export default function UiGalleryPage() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_UI_GALLERY !== 'true'
  ) {
    notFound();
  }

  return <UiGalleryClient />;
}
