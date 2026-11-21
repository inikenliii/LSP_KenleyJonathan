'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Pembungkus animasi masuk: isi muncul perlahan sambil bergeser sedikit ke
 * atas saat halaman dibuka. Dibuat sebagai komponen klien kecil supaya
 * halaman yang memakainya tetap Server Component.
 *
 * @param props.children Isi yang akan dianimasikan.
 * @returns Elemen pembungkus dengan animasi fade dan geser.
 */
export function FadeIn({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
