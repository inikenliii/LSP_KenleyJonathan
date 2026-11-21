import 'server-only';
import { BcryptPasswordHasher } from '@/lib/password-hasher';
import { prisma } from '@/lib/db';
import { SessionRepository, UserRepository, type ISessionRepository } from '@/repositories';
import { AuthService, type IAuthService } from '@/services';

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
