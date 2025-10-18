# Sistem Informasi PKL & UKK Industri — TKJ SMKN 1 Telagasari

Proyek statis berbasis HTML yang menampilkan informasi seputar Praktik Kerja Lapangan (PKL) dan Uji Kompetensi Keahlian (UKK) Industri untuk jurusan TKJ SMKN 1 Telagasari. UI menggunakan Tailwind CSS CDN dan ikon Lucide (hanya di beranda). Data dinamis diambil dari Google Apps Script Web App.

## Ringkas Fitur
- Halaman beranda: pengantar sistem dan navigasi ke halaman lain.
- Halaman Pembimbing: pilih pembimbing, lihat daftar siswa bimbingan, serta pencarian siswa lintas pembimbing.
- Halaman Penguji PKL: pilih penguji, lihat daftar siswa yang diuji, serta pencarian siswa lintas penguji.
- Halaman Peserta: pilih mitra industri untuk melihat daftar peserta PKL; dukung pencarian siswa lintas mitra.
- Halaman UKK: pilih mitra industri untuk melihat daftar kompetensi UKK yang diuji.
- Halaman Cetak Penilaian (P3-PPsp 3 Penyesuaian): lembar penilaian UKK siap cetak ukuran A4 dengan perhitungan otomatis nilai.
- Navigasi responsif (desktop + mobile menu), skeleton/loading bar, dan ringkasan data.

## Struktur Berkas
```
index.html
pembimbing.html
penguji.html
peserta.html
ukk.html
ppsp.html
config.js
README.md
```

Aset yang diharapkan ada:
- `logo.png` (ikon/logo pada navbar). Tambahkan file ini di root proyek bila belum ada.

## Prasyarat
- Tidak membutuhkan build tool. Cukup bisa dilayani sebagai situs statis.
- Koneksi internet untuk memuat:
  - Tailwind CSS CDN: https://cdn.tailwindcss.com
  - Lucide Icons (hanya index.html): https://unpkg.com/lucide@latest
  - Endpoint Google Apps Script (Web App) untuk data.
- Jika memakai Laragon (Windows) seperti direktori ini, cukup letakkan folder di `c:\laragon\www\ukkpkl` dan akses via http://localhost/ukkpkl/.

## Menjalankan Secara Lokal
- Dengan Laragon: pastikan Apache/Nginx aktif, lalu buka `http://localhost/ukkpkl/` di browser.
- Atau gunakan server statis apa pun (misal: Live Server VS Code). Semua halaman adalah file HTML statis.

## Konfigurasi Sumber Data (Google Apps Script)
Semua halaman kini menggunakan konfigurasi terpusat melalui `config.js`.

- File `config.js` mengekspor `window.APP_CONFIG.BASE_URL`. Ubah nilainya sesuai URL Web App Anda.
- Masing-masing halaman membaca dengan:
  ```js
  const BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.BASE_URL) || '';
  ```
Pastikan URL aktif dan mengembalikan JSON sesuai kontrak di bawah.

## Kontrak API (Respons JSON)
Semua request menggunakan method GET dan di-fetch dengan `cache: 'no-store'`. Status logis keberhasilan diindikasikan oleh properti `ok` pada body JSON (bukan HTTP status). Harap kembalikan struktur berikut dari Apps Script Anda.

Catatan umum respons:
- Sukses:
  ```json
  { "ok": true, "data": [ ... ], "meta": { ... } }
  ```
- Gagal:
  ```json
  { "ok": false, "error": "pesan kesalahan" }
  ```

### 1) Halaman Pembimbing (`pembimbing.html`)
- Memuat daftar pembimbing (dropdown):
  - Request: `GET ${BASE_URL}?dataset=pembimbing&route=meta`
  - Response (contoh):
    ```json
    { "ok": true, "meta": { "pembimbing": ["Nama A", "Nama B"] } }
    ```
- Memuat daftar siswa per pembimbing terpilih:
  - Request: `GET ${BASE_URL}?dataset=pembimbing&pembimbing=<NAMA>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "...", "mitra": "..." } ] }
    ```
- Pencarian siswa (lintas pembimbing):
  - Request: `GET ${BASE_URL}?dataset=pembimbing&q=<QUERY>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "...", "mitra": "...", "pembimbing": "..." } ] }
    ```

### 2) Halaman Penguji PKL (`penguji.html`)
- Memuat daftar penguji (dropdown):
  - Request: `GET ${BASE_URL}?dataset=penguji&route=meta`
  - Response:
    ```json
    { "ok": true, "meta": { "penguji": ["Nama A", "Nama B"] } }
    ```
- Memuat daftar siswa per penguji:
  - Request: `GET ${BASE_URL}?dataset=penguji&penguji=<NAMA>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "...", "mitra": "..." } ] }
    ```
- Pencarian siswa (lintas penguji):
  - Request: `GET ${BASE_URL}?dataset=penguji&q=<QUERY>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "...", "mitra": "...", "penguji": "..." } ] }
    ```

### 3) Halaman Peserta (`peserta.html`)
- Memuat daftar mitra (dropdown):
  - Request: `GET ${BASE_URL}?dataset=peserta&route=meta`
  - Response:
    ```json
    { "ok": true, "meta": { "mitra": ["Mitra 1", "Mitra 2"] } }
    ```
- Memuat daftar peserta per mitra:
  - Request: `GET ${BASE_URL}?dataset=peserta&mitra=<NAMA_MITRA>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "..." } ] }
    ```
- Pencarian siswa (lintas mitra):
  - Request: `GET ${BASE_URL}?dataset=peserta&q=<QUERY>`
  - Response:
    ```json
    { "ok": true, "data": [ { "siswa": "...", "kelas": "...", "mitra": "..." } ] }
    ```

### 4) Halaman UKK (`ukk.html`)
Catatan: Halaman ini memanggil endpoint tanpa parameter `dataset`. Pastikan Apps Script menangani route umum berikut.
- Memuat daftar mitra (dropdown):
  - Request: `GET ${BASE_URL}?route=meta`
  - Response:
    ```json
    { "ok": true, "meta": { "mitra": ["Mitra 1", "Mitra 2"] } }
    ```
- Memuat daftar kompetensi per mitra:
  - Request: `GET ${BASE_URL}?mitra=<NAMA_MITRA>`
  - Response:
    ```json
    { "ok": true, "data": [ { "kompetensi": "..." } ] }
    ```

### 5) Halaman Cetak Penilaian UKK (`ppsp.html`)
Halaman ini meniru format P3-PPsp 3 (Penyesuaian) sebagai lembar penilaian siap-cetak ukuran A4. Tidak membutuhkan API. Field identitas bisa diisi manual atau diisi otomatis via parameter URL. Nilai dihitung otomatis dari Bobot (%) dan Skor (1–4) per baris.

- Field yang didukung (parameter URL opsional):
  - `nama`, `nisn`, `kelas`, `mitra`, `kompetensi`, `tanggal`, `penguji`, `pembimbing`
- Baris penilaian default dan bobot dapat diedit langsung di tabel. Rumus: Nilai = Bobot × (Skor/4). Nilai Akhir = Σ Nilai (maks 100). Predikat: A ≥90, B ≥80, C ≥70, D <70.
- Contoh akses lokal:
  - `http://localhost/ukkpkl/ppsp.html?nama=Ahmad%20Setiawan&nisn=1234567890&kelas=XII%20TKJ-1&mitra=PT%20Contoh%20Jaya&kompetensi=Instalasi%20Jaringan%20LAN&tanggal=18-10-2025&penguji=Bpk.%20Dedi&pembimbing=Ibu%20Rina`
- Cara cetak: buka halaman lalu klik tombol "Cetak" di toolbar (atau Ctrl+P). Ukuran halaman otomatis A4 dengan margin 12 mm.

Catatan: Struktur presisi P3-PPsp 3 mungkin berbeda antar instansi. Jika Anda ingin menyesuaikan label, jumlah baris, atau ruang tanda tangan agar 100% sama dengan dokumen, silakan beri contoh perubahan—kita bisa sesuaikan.

## Aksesibilitas & UX
- Navigasi responsif dengan tombol burger pada lebar layar kecil.
- Indikator loading: shimmer skeleton dan progress bar.
- Ringkasan data (nama pembimbing/penguji/mitra dan jumlah baris) ditampilkan setelah data berhasil dimuat.

## Troubleshooting
- Dropdown tidak terisi atau tabel kosong:
  - Cek koneksi internet dan bahwa URL `BASE_URL` benar serta di-deploy sebagai Web App (akses Anyone).
  - Buka DevTools (F12) > Network, pastikan respons JSON `ok: true` dan struktur sesuai kontrak.
- Ikon/Styling tidak tampil:
  - Pastikan CDN Tailwind aktif. Untuk ikon di `index.html`, pastikan skrip Lucide termuat dan `lucide.createIcons()` dipanggil.
- CORS/Permission error dari Apps Script:
  - Deploy ulang Web App dengan akses yang sesuai (Anyone) dan update `BASE_URL` jika versi/deployment berubah.

## Pengembangan
- Proyek ini statis, tidak ada build step. Anda bisa menduplikasi pola komponen dari halaman lain untuk konsistensi.
- Disarankan mengekstrak nav/footer ke file terpisah bila beralih ke templating (mis: Eleventy, Vite + HTML includes) agar DRY.

## Lisensi
Konten ini ditujukan untuk kebutuhan internal/pendidikan TKJ SMKN 1 Telagasari. Jika ingin dipublikasikan ulang, mohon cantumkan atribusi yang sesuai.

---

## Limitasi & Catatan Teknis Penting
- Tailwind via CDN (Play CDN) tidak memproses `@apply`. Di `index.html` terdapat deklarasi CSS:
  ```css
  .icon-box { @apply h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600; }
  ```
  Ini tidak akan berfungsi karena `@apply` membutuhkan proses build Tailwind. Solusi cepat: hapus `.icon-box` dan tempelkan utilitas Tailwind langsung pada elemen yang membutuhkan. Opsi lain: setel pipeline Tailwind (CLI/PostCSS) agar `@apply` diproses saat build.
- Fetch memakai `cache: 'no-store'` untuk menghindari data basi. Ini menambah request ke Apps Script setiap interaksi. Jika ingin mengurangi beban, Anda bisa menambahkan cache sederhana di memori pada sisi klien (mis. menyimpan hasil dropdown/meta selama sesi).
- Aksesibilitas: beberapa halaman sudah memakai atribut ARIA (mis. `aria-expanded`, `aria-controls`, `aria-current`). Pastikan nilai ARIA disinkronkan saat toggle menu agar tetap aksesibel.
- Mode Cetak: `peserta.html` dan `ukk.html` menyembunyikan elemen tertentu saat cetak via `@media print`.
- Aset `logo.png` wajib ada di root untuk tampilan navbar; bila belum tersedia, tambahkan file tersebut.

## Deployment (Hosting)
Proyek ini adalah situs multi-halaman statis. Opsi hosting umum:
- Laragon/XAMPP/Apache lokal: sudah didukung, akses via `http://localhost/ukkpkl/`.
- GitHub Pages/Netlify/Vercel/Cloudflare Pages: unggah semua file di root. Tidak ada routing SPA yang rumit, karena setiap halaman adalah file `.html` terpisah.

Catatan Apps Script:
- Pastikan Web App di-deploy dengan akses publik (Anyone). Jika menggunakan versi baru, URL `BASE_URL` biasanya berubah—perbarui di setiap halaman.
- CORS harus mengizinkan asal domain hosting Anda. Umumnya Apps Script Web App publik aman untuk fetch lintas domain.

## Konfigurasi Terpusat BASE_URL
Konfigurasi terpusat sudah diterapkan. Cukup ubah `config.js` saat URL Web App berganti—tidak perlu menyunting tiap halaman.

## Checklist Verifikasi (Pertama Kali Jalan)
- [ ] `logo.png` tersedia di root proyek.
- [ ] `BASE_URL` aktif dan merespons sesuai kontrak (uji langsung dari browser DevTools > Network).
- [ ] Dropdown meta (pembimbing/penguji/mitra) terisi.
- [ ] Pencarian dengan ≥2 huruf menampilkan hasil.
- [ ] Burger menu berfungsi (ikon berganti dan menu muncul/ditutup).

## Troubleshooting Tambahan
- Halaman tampak “tanpa styling” atau ikon tidak muncul:
  - Periksa koneksi ke CDN Tailwind/Lucide di tab Network.
  - Jika memakai policy jaringan ketat, simpan Tailwind/ikon secara lokal atau gunakan build pipeline.
- Data tidak muncul dan tidak ada error jelas:
  - Buka DevTools > Console & Network. Pastikan body JSON punya `ok: true`.
  - Cek apakah parameter `dataset`, `route`, atau query lain sesuai dengan kontrak di atas.
- Error perizinan Apps Script:
  - Deploy ulang Web App (New deployment) dan set akses “Anyone”. Ganti `BASE_URL` di proyek jika URL deployment baru.
- Mixed Content (http vs https):
  - Jika situs di-host melalui HTTPS, pastikan `BASE_URL` juga HTTPS.

## Ide Peningkatan (Non-breaking)
- Centralized config (`config.js`) untuk `BASE_URL` agar pemeliharaan lebih mudah.
- Ekstraksi navbar/footer ke partial untuk menghindari duplikasi (butuh tool templating atau bundler ringan).
- Penambahan cache memori singkat untuk endpoint meta agar lebih hemat request.
- Validasi tambahan pada respons untuk menahan UI saat data tidak lengkap.

## Quality gates (sesi ini)
- Build: PASS (tidak ada proses build)
- Lint/Typecheck: N/A (tanpa tool lint/type terkonfigurasi)
- Tests: N/A (belum ada test otomatis)
