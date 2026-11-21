import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Menggabungkan beberapa nilai class menjadi satu string class Tailwind.
 *
 * Nilai yang kosong atau bernilai false diabaikan (lewat clsx), lalu class
 * Tailwind yang saling bertabrakan diselesaikan dengan memenangkan class
 * terakhir (lewat tailwind-merge). Dipakai oleh komponen di `components/ui`.
 *
 * @param inputs Nama class, objek kondisi, atau larik class.
 * @returns String class yang sudah digabung dan bebas bentrok.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
