import 'server-only';
import { BcryptPasswordHasher } from '@/lib/password-hasher';
import { prisma } from '@/lib/db';
import { LocalPaymentProofStorage } from '@/lib/payment-proof-storage';
import {
  GarageRepository,
  RentalExtensionRepository,
  RentalRepository,
  ReportRepository,
  SessionRepository,
  UserRepository,
  type ISessionRepository,
} from '@/repositories';
import {
  AuthService,
  GarageService,
  RentalExtensionService,
  RentalService,
  ReportService,
  VerificationService,
  type IAuthService,
  type IGarageService,
  type IRentalExtensionService,
  type IRentalService,
  type IReportService,
  type IVerificationService,
} from '@/services';

/**
 * @file Titik perakitan objek (composition root).
 *
 * Halaman dan Server Action hanya mengambil layanan dari modul ini; mereka
 * tidak pernah membuat repository atau menyentuh klien Prisma sendiri.
 */

/** Repository pengguna berbasis Prisma. */
export const userRepository = new UserRepository(prisma);

/** Pengaman password bcrypt. */
export const passwordHasher = new BcryptPasswordHasher();

/** Layanan autentikasi dengan repository dan pengaman password di atas. */
export const authService: IAuthService = new AuthService(userRepository, passwordHasher);

/** Repository sesi login pada tabel session. */
export const sessionRepository: ISessionRepository = new SessionRepository(prisma);

/** Layanan verifikasi pendaftar di atas repository pengguna. */
export const verificationService: IVerificationService = new VerificationService(userRepository);

/** Layanan garasi di atas repository garasi. */
export const garageService: IGarageService = new GarageService(new GarageRepository(prisma));

/** Layanan sewa di atas repository sewa dan penyimpanan bukti pembayaran lokal. */
export const rentalService: IRentalService = new RentalService(
  new RentalRepository(prisma),
  new LocalPaymentProofStorage(),
);

/**
 * Layanan perpanjangan sewa. Bukti pembayaran perpanjangan memakai penyimpanan
 * dan folder yang sama dengan bukti sewa; nama berkasnya UUID acak.
 */
export const rentalExtensionService: IRentalExtensionService = new RentalExtensionService(
  new RentalExtensionRepository(prisma),
  new LocalPaymentProofStorage(),
);

/** Layanan laporan sewa di atas repository laporan (hanya membaca). */
export const reportService: IReportService = new ReportService(new ReportRepository(prisma));
