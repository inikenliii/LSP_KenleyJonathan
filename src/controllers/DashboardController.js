/**
 * @file Controller halaman beranda per peran: Dasbor Admin dan Beranda Penyewa.
 */

/**
 * Handler HTTP untuk halaman utama Admin dan Penyewa. Akses sudah dijaga
 * oleh middleware pada router masing-masing.
 */
export class DashboardController {
  /**
   * Menampilkan Dasbor Admin.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {void}
   */
  admin = (req, res) => {
    res.render('admin/dashboard', { user: req.user.toView() });
  };

  /**
   * Menampilkan Beranda Penyewa berisi data akun penyewa sendiri.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {void}
   */
  renter = (req, res) => {
    res.render('penyewa/home', { user: req.user.toView() });
  };
}
