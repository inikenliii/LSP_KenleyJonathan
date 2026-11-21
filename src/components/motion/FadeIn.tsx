import * as motion from 'motion/react-client';
import type { ReactNode } from 'react';

/**
 * Animasi masuk: isi muncul perlahan sambil bergeser sedikit ke atas.
 * Memakai `motion/react-client` sehingga dapat dipakai langsung dari Server
 * Component. Hanya dipakai membungkus kartu halaman dan tidak menentukan
 * kebenaran tampilan.
 *
 * @param props.children Isi yang dianimasikan.
 * @param props.delay Jeda sebelum animasi mulai, dalam detik.
 * @returns Pembungkus dengan animasi fade dan geser.
 */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {children}
    </motion.div>
  );
}
