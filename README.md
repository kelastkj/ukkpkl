# Sistem Informasi PKL & UKK Industri — TKJ SMKN 1 Telagasari

> **Dokumentasi Lengkap untuk Deployment dan Maintenance**

Sistem web berbasis untuk mengelola **Praktik Kerja Lapangan (PKL)** dan **Uji Kompetensi Keahlian (UKK) Industri** di jurusan TKJ SMKN 1 Telagasari. Aplikasi ini menggunakan Google Apps Script sebagai backend dan Google Sheets sebagai database.

---

## 📃 Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Persiapan Awal](#persiapan-awal)
4. [Setup Backend (Google Apps Script)](#setup-backend-google-apps-script)
5. [Setup Frontend (HTML)](#setup-frontend-html)
6. [Konfigurasi Notifikasi WhatsApp](#konfigurasi-notifikasi-whatsapp)
7. [Cara Menggunakan Aplikasi](#cara-menggunakan-aplikasi)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance dan Update](#maintenance-dan-update)

---

## 🎯 Fitur Utama

### Halaman Publik (Tanpa Login)
- **Beranda (`index.html`)**: Pengantar sistem, panduan PKL & UKK, slideshow dokumentasi
- **Pembimbing (`pembimbing.html`)**: Daftar siswa per pembimbing, pencarian siswa
- **Penguji (`penguji.html`)**: Daftar siswa per penguji, pencarian siswa
- **Peserta (`peserta.html`)**: Daftar peserta per mitra industri
- **UKK (`ukk.html`)**: Daftar kompetensi UKK per mitra
- **Penilaian (`ppsp.html`)**: Form cetak penilaian UKK (A4)

### Halaman Terlindungi (Memerlukan Login)
- **Login (`login.html`)**: Autentikasi siswa dan guru
- **Dashboard (`dashboard.html`)**: 
  - **Siswa**: Upload laporan PKL dan dokumentasi UKK, lihat nilai
  - **Guru**: Monitoring upload siswa, akses bimbingan dan pengujian
- **Bimbingan (`bimbingan.html`)**: Kelola siswa bimbingan (khusus guru)
- **Pengujian (`pengujian.html`)**: Input nilai presentasi siswa (khusus guru)
- **Sertifikat (`sertifikat.html`)**: Generate sertifikat UKK (khusus guru)

### Fitur Tambahan
- **Notifikasi WhatsApp otomatis** ke penguji saat siswa upload dokumen
- **Upload file ke Google Drive** dengan penamaan otomatis
- **Manajemen user berbasis role** (siswa/guru)
- **Responsive design** dengan Tailwind CSS
- **Offline-friendly** dengan skeleton loader

---

## 🏗️ Arsitektur Sistem

```mermaid
flowchart TD
   A[USER (Browser)\nindex.html, login.html, dashboard.html, dll.] -->|HTTPS Request| B[Google Apps Script (Backend)]
   B --> S[(Google Sheets\nDatabase)]
   B --> D[(Google Drive\nStorage)]
   B --> F[(Fonnte WhatsApp\nGateway)]
```

### Teknologi Stack
- **Frontend**: HTML5, Tailwind CSS (CDN), Lucide Icons, Vanilla JavaScript
- **Backend**: Google Apps Script (JavaScript-based)
- **Database**: Google Sheets
- **Storage**: Google Drive
- **Notifications**: Fonnte WhatsApp API
- **Hosting**: Static Web Server (Laragon, Apache, Nginx, atau GitHub Pages)

---

## 🚀 Persiapan Awal

### 1. Template Google Spreadsheet
Duplikat template spreadsheet dari:
```
https://docs.google.com/spreadsheets/d/1mbM9W8vjri9Nc1_Dw6hlikm_Q3bmVQFdrmW1tUFI4To/edit?usp=sharing
```

Template ini sudah berisi sheet dengan header yang sesuai:
- **USERS**: username | password_hash | role | nama | kelas | mitra | phone
- **PEMBIMBING**: no | pembimbing | siswa | kelas | mitra
- **PENGUJI**: no | penguji | siswa | kelas | mitra | phone
- **PESERTA**: mitra | siswa | kelas
- **UKK**: mitra | kompetensi | logo
- **UPLOADS**: (dibuat otomatis saat upload pertama)
- **NILAI-PRESENTASI**: (untuk input nilai presentasi siswa)
- **NILAI-PKL**: (untuk nilai laporan PKL)
- **NILAI-UKK**: (untuk hasil UKK: Kompeten/Belum Kompeten)
- **SERTIFIKAT**: nama_siswa | nisn | jurusan | mitra | keterangan | penanggung_jawab | jabatan | nomor_surat | link
- **NOTIFICATIONS**: (log notifikasi WhatsApp)

### 2. Folder Google Drive
Buat 3 folder di Google Drive:
1. **Folder PKL** - untuk menyimpan laporan PKL siswa
2. **Folder UKK** - untuk menyimpan dokumentasi UKK siswa  
3. **Folder Sertifikat** - untuk menyimpan sertifikat yang digenerate

Catat ID masing-masing folder (terlihat di URL):
```
https://drive.google.com/drive/folders/[ID_FOLDER_INI]
```

### 3. Template Sertifikat (Opsional)
**Duplikat template sertifikat dari:**
```
https://docs.google.com/document/d/1VbMyURPKZWlm2oMHtD3zwChkoLDOiTJGDaYXHMdeuXY/edit?usp=sharing
```

Jika menggunakan fitur generate sertifikat, template sudah berisi placeholder:
- `{{nama_siswa}}`, `{{nisn}}`, `{{jurusan}}`, `{{mitra}}`, `{{keterangan}}`
- `{{penanggung_jawab}}`, `{{jabatan}}`, `{{nomor_surat}}`
- `{{logo_mitra}}`, `{{tabel_kompetensi}}`

**Cara menggunakan template:**
1. Buka link di atas
2. Klik **File** > **Make a copy**
3. Rename menjadi "Template Sertifikat UKK - TKJ"
4. Copy ID dokumen dari URL (bagian `/d/[ID_INI]/edit`)
5. Paste ID ke konstanta `TEMPLATE_SERTIFIKAT_ID` di `code-wa-fonnte.gs`

---

## ⚙️ Setup Backend (Google Apps Script)

### Langkah 1: Buat Project Apps Script

1. Buka spreadsheet yang sudah diduplikat
2. Klik **Extensions** > **Apps Script**
3. Hapus kode default `function myFunction() {}`
4. Copy-paste seluruh isi file `code-wa-fonnte.gs` dari repository ini
5. Simpan dengan nama project yang jelas (misal: "PKL-UKK-Backend")

### Langkah 2: Konfigurasi Konstanta

Edit bagian atas file `code-wa-fonnte.gs`:

```javascript
// === WAJIB DIISI ===
const FOLDER_PKL_ID    = 'YOUR_PKL_FOLDER_ID_HERE';
const FOLDER_UKK_ID    = 'YOUR_UKK_FOLDER_ID_HERE';
const FOLDER_SERTIFIKAT_ID = 'YOUR_SERTIFIKAT_FOLDER_ID_HERE';
const TEMPLATE_SERTIFIKAT_ID = "YOUR_TEMPLATE_SERTIFIKAT_ID_HERE"; // (opsional)

// === OPSIONAL (Notifikasi WhatsApp via Fonnte) ===
const FONTE_API_URL_DEFAULT   = 'https://api.fonnte.com/send';
const FONTE_API_TOKEN_DEFAULT = 'YOUR_FONNTE_TOKEN_HERE'; // Dapatkan dari fonnte.com
```

**Cara mendapatkan Folder ID:**
```
URL: https://drive.google.com/drive/folders/1RZIHlwgAeWKlxTxt-KZ_OjC2cJBjq2dS
                                            ↑────────── Ini adalah Folder ID
```

### Langkah 3: Setup User dan Password

Di sheet **USERS**, tambahkan data user:

| username | password_hash | role | nama | kelas | mitra | phone |
|----------|--------------|------|------|-------|-------|-------|
| siswa01 | =HASH_SHA256("password123") | siswa | Ahmad Setiawan | XII TKJ-1 | PT Telkom | 628123456789 |
| guru01 | =HASH_SHA256("guru123") | guru | Bapak Dedi | - | - | 628987654321 |

**Penting**: 
- Gunakan formula `=HASH_SHA256("password_asli")` untuk mengenkripsi password
- Role yang valid: `siswa` atau `guru`
- Nomor telepon untuk notifikasi WhatsApp (format: 628xxx)

### Langkah 4: Deploy sebagai Web App

1. Klik tombol **Deploy** > **New deployment**
2. Pilih type: **Web app**
3. Atur konfigurasi:
   - **Description**: PKL & UKK System v1.0
   - **Execute as**: Me (email@domain.com)
   - **Who has access**: **Anyone** (penting!)
4. Klik **Deploy**
5. **Copy URL Web App** yang diberikan (format: `https://script.google.com/macros/s/AKfycb.../exec`)
6. Authorize akses jika diminta

**⚠️ Setiap kali update kode, deploy versi baru:**
- Deploy > Manage deployments > ✏️ Edit > Version: New version > Deploy

### Langkah 5: Setup Script Properties (Opsional untuk WhatsApp)

Untuk keamanan, simpan API token di Script Properties:

1. Di Apps Script, klik **Project Settings** (⚙️)
2. Scroll ke **Script Properties**
3. Tambahkan:
   ```
   FONTE_API_URL = https://api.fonnte.com/send
   FONTE_API_TOKEN = YOUR_ACTUAL_TOKEN_HERE
   ```

---

## 🎨 Setup Frontend (HTML)

### Langkah 1: Clone/Download Repository

```bash
# Clone repository
git clone https://github.com/kelastkj/ukkpkl.git
cd ukkpkl

# Atau download ZIP dan extract
```

### Langkah 2: Konfigurasi BASE_URL

Edit file `config.js`:

```javascript
(function(){
  const CONFIG = {
   BASE_URL: 'https://script.google.com/macros/s/AKfycb.../exec' // ← Paste URL dari Deploy
  };
  
  Object.freeze(CONFIG);
  window.APP_CONFIG = CONFIG;
})();
```

### Langkah 3: Tambahkan Logo

Letakkan file `logo.png` di root folder. Logo digunakan di navbar semua halaman.

### Langkah 4: Hosting Lokal (Development)

**Dengan Laragon (Windows):**
```
1. Copy folder ke c:\laragon\www\ukkpkl
2. Start Laragon (Apache)
3. Akses: http://localhost/ukkpkl/
```

**Dengan VS Code Live Server:**
```
1. Install extension "Live Server"
2. Right-click index.html > Open with Live Server
3. Akses: http://127.0.0.1:5500/
```

**Dengan Python:**
```bash
cd ukkpkl
python -m http.server 8000
# Akses: http://localhost:8000/
```

### Langkah 5: Deployment Production

**GitHub Pages:**
```bash
1. Push ke GitHub repository
2. Settings > Pages > Branch: main > /root > Save
3. Akses: https://username.github.io/ukkpkl/
```

**Netlify/Vercel:**
```bash
# Drag & drop folder ke dashboard
# Atau deploy via CLI
netlify deploy --prod
```

**Cloudflare Pages:**
```bash
# Connect GitHub repo atau upload folder
# Auto-deploy on git push
```

---

## 📱 Konfigurasi Notifikasi WhatsApp

Sistem menggunakan **Fonnte** untuk mengirim notifikasi WhatsApp otomatis ke penguji saat siswa upload dokumen.

### Langkah 1: Daftar Fonnte

1. Kunjungi [fonnte.com](https://fonnte.com)
2. Daftar akun baru (gratis untuk 100 pesan/hari)
3. Connect nomor WhatsApp Anda
4. Copy **API Token** dari dashboard

### Langkah 2: Konfigurasi di Apps Script

**Opsi A: Edit konstanta di code-wa-fonnte.gs**
```javascript
const FONTE_API_TOKEN_DEFAULT = 'TOKEN_DARI_FONNTE';
```

**Opsi B: Gunakan Script Properties (lebih aman)**
```
Project Settings > Script Properties > Add:
- FONTE_API_URL = https://api.fonnte.com/send
- FONTE_API_TOKEN = TOKEN_DARI_FONNTE
```

### Langkah 3: Tambahkan Nomor Telepon Penguji

Di sheet **PENGUJI**, tambahkan kolom `phone`:

| no | penguji | siswa | kelas | mitra | phone |
|----|---------|-------|-------|-------|-------|
| 1 | Bapak Dedi | Ahmad | XII TKJ-1 | PT Telkom | 628123456789 |

**Format nomor**: 
- ✅ Benar: `628123456789` (62 = kode Indonesia)
- ❌ Salah: `08123456789`, `8123456789`, `+62-812-3456-789`

### Cara Kerja Notifikasi

1. Siswa upload laporan PKL/UKK via dashboard
2. Sistem mencari penguji siswa tersebut di sheet PENGUJI
3. Sistem lookup nomor telepon penguji di sheet USERS atau PENGUJI
4. Kirim pesan WhatsApp melalui Fonnte API:
   ```
   Yth. Bapak/Ibu [Nama Penguji],
   
   Informasi: siswa *[Nama Siswa]* telah mengunggah Laporan PKL dengan file: [nama_file.pdf].
   
   1) Untuk melihat berkas: https://drive.google.com/file/d/xxx/view
   2) Untuk memberi penilaian: https://pkl.kelastkj.online/ -> login -> menu "Pengujian"
   
   Terima kasih.
   ```

### Debug Notifikasi

Jika notifikasi tidak terkirim, cek sheet **NOTIFICATIONS**:
- `status=config_missing`: API token belum diset
- `status=no_penguji`: Tidak ada penguji untuk siswa tersebut
- `status=no_phones`: Penguji tidak punya nomor telepon
- `status=sent`: Notifikasi berhasil terkirim
- `status=failed`: API error (cek httpCode & responseBody)

---

## 📖 Cara Menggunakan Aplikasi

### Untuk Admin/Pembuat

#### 1. Setup Data Awal

**Sheet PEMBIMBING:**
```
no | pembimbing | siswa | kelas | mitra
1  | Ibu Rina   | Ahmad | XII TKJ-1 | PT Telkom
2  | Ibu Rina   | Budi  | XII TKJ-1 | PT Telkom
```

**Sheet PENGUJI:**
```
no | penguji    | siswa | kelas | mitra | phone
1  | Bpk Dedi   | Ahmad | XII TKJ-1 | PT Telkom | 628123456789
2  | Bpk Dedi   | Budi  | XII TKJ-1 | PT Telkom | 628123456789
```

**Sheet PESERTA:**
```
mitra | siswa | kelas
PT Telkom | Ahmad | XII TKJ-1
PT Telkom | Budi  | XII TKJ-1
```

**Sheet UKK:**
```
mitra | kompetensi | logo
PT Telkom | Instalasi Jaringan LAN | https://logo-url.com/telkom.png
PT Telkom | Konfigurasi Router Mikrotik | https://logo-url.com/telkom.png
```

**Sheet SERTIFIKAT:**
```
nama_siswa | nisn | jurusan | mitra | keterangan | penanggung_jawab | jabatan | nomor_surat | link
Ahmad Setiawan | 1234567890 | XII TKJ | PT Telkom | Kompeten | Bpk Dedi | Supervisor IT | 001/UKK/2025 | (kosongkan, akan diisi otomatis)
```

#### 2. Buat Akun User

Di sheet **USERS**, tambahkan:
```
username | password_hash | role | nama | kelas | mitra | phone
ahmad01  | =HASH_SHA256("siswa123") | siswa | Ahmad Setiawan | XII TKJ-1 | PT Telkom | 628111111111
dedi01   | =HASH_SHA256("guru123")  | guru  | Bapak Dedi | - | - | 628222222222
```

### Untuk Siswa

#### 1. Login
```
1. Buka https://pkl.kelastkj.online/login.html
2. Masukkan username dan password
3. Klik "Masuk"
```

#### 2. Upload Laporan PKL
```
1. Di Dashboard, pilih "Upload Laporan PKL"
2. Pilih file PDF (maks 10MB)
3. Klik "Upload"
4. Tunggu konfirmasi "Upload berhasil"
```

**Format nama file di Drive:** `Nama Siswa - PKL.pdf`

#### 3. Upload Dokumentasi UKK
```
1. Di Dashboard, pilih "Upload Dokumentasi UKK"
2. Pilih file PDF berisi minimal 5 foto (maks 5MB)
3. Klik "Upload"
```

**Format nama file di Drive:** `Nama Siswa - UKK.pdf`

#### 4. Lihat Nilai
Setelah penguji input nilai, nilai akan muncul di hero card dashboard:
- **Nilai Presentasi** (0-100): Rata-rata aspek presentasi
- **Nilai PKL** (0-100): Nilai akhir laporan PKL
- **Hasil UKK**: Kompeten / Belum Kompeten

### Untuk Guru/Penguji

#### 1. Login
```
Username: dedi01
Password: guru123
```

#### 2. Monitoring Upload Siswa
```
Dashboard > Lihat daftar upload siswa yang dibimbing/diuji
- Tab PKL: Laporan PKL
- Tab UKK: Dokumentasi UKK
- Klik ikon 👁️ untuk buka file di Drive
```

#### 3. Input Nilai Presentasi
```
1. Klik menu "Pengujian"
2. Pilih siswa dari dropdown
3. Input nilai untuk setiap aspek (0-100):
   - Struktur Presentasi
   - Penyampaian
   - Penguasaan Materi
   - Penggunaan Media
   - Sikap Profesional
4. Klik "Simpan Nilai"
```

**Nilai Total** dihitung otomatis sebagai rata-rata 5 aspek.

#### 4. Generate Sertifikat (Opsional)
```
1. Klik menu "Sertifikat"
2. Pilih siswa atau klik "Generate Semua"
3. Sertifikat PDF akan tersimpan di Google Drive
4. Link PDF otomatis tercatat di sheet SERTIFIKAT
```

---

## 🔧 Troubleshooting

### Error: "Sesi tidak valid"
**Penyebab**: Token login expired atau tidak valid
**Solusi**: 
```
1. Logout dari menu profil (kanan atas)
2. Login ulang
3. Jika tetap error, clear browser cache/cookies
```

### Error: "Folder Drive belum dikonfigurasi"
**Penyebab**: `FOLDER_PKL_ID` atau `FOLDER_UKK_ID` kosong/salah
**Solusi**:
```
1. Cek file code-wa-fonnte.gs
2. Pastikan FOLDER_PKL_ID dan FOLDER_UKK_ID sudah diisi
3. Deploy ulang Apps Script (New version)
4. Update config.js dengan URL deployment baru
```

### Notifikasi WhatsApp tidak terkirim
**Diagnosis**:
```
1. Buka sheet NOTIFICATIONS
2. Cek kolom 'status' baris terakhir:
   - config_missing → Set FONTE_API_TOKEN
   - no_penguji → Tambahkan penguji di sheet PENGUJI
   - no_phones → Tambahkan kolom 'phone' di sheet PENGUJI
   - failed → Cek httpCode (401=token salah, 429=limit exceeded)
```

**Solusi**:
```
# Jika httpCode=401 (Unauthorized)
1. Cek FONTE_API_TOKEN di Script Properties
2. Login ke fonnte.com, copy ulang token
3. Update Script Properties

# Jika httpCode=429 (Too Many Requests)
1. Upgrade paket Fonnte
2. Atau tunggu 24 jam (reset quota)
```

### Upload gagal: "Data file kosong"
**Penyebab**: File tidak terpilih atau terlalu besar
**Solusi**:
```
1. Pastikan file sudah dipilih
2. Cek ukuran file:
   - PKL: maksimal 10MB
   - UKK: maksimal 5MB
3. Jika terlalu besar, kompres PDF dengan tools online
```

### Halaman tampil tanpa styling
**Penyebab**: CDN Tailwind tidak termuat
**Solusi**:
```
1. Cek koneksi internet
2. Buka DevTools (F12) > Console, cek error
3. Jika firewall/proxy blokir CDN, download Tailwind lokal:
   - Download dari https://cdn.tailwindcss.com
   - Save sebagai tailwind.js
   - Edit HTML: <script src="tailwind.js"></script>
```

### Data tidak muncul / Tabel kosong
**Diagnosis**:
```
1. Buka DevTools (F12) > Network tab
2. Cari request ke script.google.com
3. Klik request > Preview > Cek response JSON
```

**Penyebab & Solusi**:
```
# Jika ok:false, error:"Header XXX wajib"
→ Tambahkan kolom yang missing di sheet

# Jika ok:false, error:"Parameter dataset diperlukan"
→ Cek config.js, pastikan BASE_URL benar

# Jika HTTP 404
→ URL Apps Script salah atau deployment dihapus
→ Deploy ulang, update config.js

# Jika CORS error
→ Deploy Apps Script dengan "Who has access: Anyone"
```

---

## 🛠️ Maintenance dan Update

### Update Kode Backend

```
1. Edit code-wa-fonnte.gs di Apps Script
2. Save (Ctrl+S)
3. Deploy > Manage deployments > ✏️ Edit active deployment
4. Version: New version
5. Description: "Update fitur XXX"
6. Deploy

Catatan: URL tetap sama, tidak perlu update config.js
```

### Update Kode Frontend

```
1. Edit file HTML/CSS/JS di code editor
2. Save
3. Jika hosting lokal: Refresh browser (Ctrl+Shift+R)
4. Jika GitHub Pages: Push ke repository, tunggu 1-2 menit
```

### Backup Data

**Backup Spreadsheet:**
```
File > Make a copy > Rename dengan tanggal
Contoh: "PKL-UKK-Data-Backup-2025-01-15"
```

**Backup Drive:**
```
1. Buka Google Drive
2. Right-click folder PKL/UKK/Sertifikat
3. Download > Zip file
4. Simpan di storage aman (external HDD/cloud backup)
```

### Monitoring Penggunaan

**Cek Quota Apps Script:**
```
1. Apps Script > Project Settings
2. Lihat "Executions" dalam 24 jam terakhir
3. Limit: 90 menit CPU time/hari (biasanya cukup)
```

**Cek Storage Drive:**
```
1. Google Drive > Storage
2. Jika hampir penuh (>80% dari 15GB gratis):
   - Hapus file lama yang tidak terpakai
   - Atau upgrade ke Google One
```

### Menambah Fitur Baru

**Contoh: Tambah kolom "Nilai Industri" di sheet NILAI-PKL**

Backend (Apps Script):
```javascript
// Tambahkan di function _readNilaiPKL()
rows.push({ 
  username: v[idx['username']]||'', 
  nama: v[idx['nama']]||'', 
  total: v[idx['total']]||'',
   nilai_industri: v[idx['nilai_industri']]||'', // ← Tambahan
  timestamp: v[idx['timestamp']]||''
});
```

Frontend (dashboard.html):
```html
<!-- Tambahkan badge baru di hero card -->
<span id="score-industri" class="hero-badge hidden">
  <i data-lucide="building" class="w-4 h-4"></i>
  <div class="flex flex-col leading-tight">
    <span id="score-industri-val" class="font-semibold text-sm">-</span>
    <span class="text-[10px] opacity-90">Nilai Industri</span>
  </div>
</span>
```

```javascript
// Tambahkan di function loadMyScores()
const me = pklResp.data.find(r => String(r.username) === String(username));
if(me){ 
  document.getElementById('score-industri-val').textContent = (me.nilai_industri||'');
  document.getElementById('score-industri').classList.remove('hidden');
}
```

---

## 📝 Catatan Penting

### Keamanan

1. **Jangan commit sensitive data ke GitHub:**
   ```
   # .gitignore
   config-private.js
   *.env
   ```

2. **Password di sheet harus ter-hash:**
   ```
   ❌ Jangan: password123 (plain text)
   ✅ Benar: =HASH_SHA256("password123")
   ```

3. **Script Properties untuk API token:**
   ```
   Jangan hardcode token di kode
   Gunakan Script Properties (encrypted at rest)
   ```

### Performa

1. **Cache di browser:** File statis sudah set cache-control
2. **JSONP untuk avoid CORS:** Backend support `?callback=func`
3. **Lazy loading:** Gunakan `loading="lazy"` untuk gambar
4. **Minimize requests:** Batch fetch data di `loadMyUploads()`

### Compliance

1. **GDPR/Privacy:** Sistem tidak menyimpan data sensitif
2. **Data retention:** Atur policy hapus data lama (1-2 tahun)
3. **Backup rutin:** Minimal backup bulanan spreadsheet & Drive

---

## 📞 Support & Kontak

**Developer:**
- GitHub: [@kelastkj](https://github.com/kelastkj)
- Repository: [github.com/kelastkj/ukkpkl](https://github.com/kelastkj/ukkpkl)

**Dokumentasi:**
- README: Lihat file ini
- Code Comments: Semua fungsi penting sudah dijelaskan
- API Contract: Lihat bagian "Kontrak API" di bawah

---

## 🗂️ Struktur Berkas Lengkap

```
ukkpkl/
├─ index.html              # Beranda & panduan
├─ login.html              # Halaman login
├─ dashboard.html          # Dashboard siswa/guru
├─ pembimbing.html         # Daftar pembimbing
├─ penguji.html            # Daftar penguji
├─ pengujian.html          # Input nilai presentasi (guru)
├─ bimbingan.html          # Kelola bimbingan (guru)
├─ peserta.html            # Daftar peserta PKL
├─ ukk.html                # Kompetensi UKK
├─ ppsp.html               # Form penilaian cetak
├─ sertifikat.html         # Generate sertifikat (guru)
├─ config.js               # Konfigurasi BASE_URL
├─ code-wa-fonnte.gs       # Backend Apps Script
├─ code.gs                 # (deprecated, gunakan code-wa-fonnte.gs)
├─ logo.png                # Logo aplikasi
├─ README.md               # Dokumentasi ini
├─ CNAME                   # (opsional, untuk custom domain)
└─ slide/                  # Folder gambar slideshow
   ├─ IMG-20240305-WA0034-scaled.jpg
   ├─ IMG20240304133855-scaled.jpg
   └─ ... (8 gambar total)
```

---

## 🔌 Kontrak API (Backend Endpoints)

Semua request menggunakan **GET** atau **POST** ke `BASE_URL`:
```
https://script.google.com/macros/s/AKfycb.../exec
```

### Response Format

**Success:**
```json
{
  "ok": true,
  "data": [...],
  "meta": {...},
  "count": 10,
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Pesan kesalahan"
}
```

### Endpoints

#### 1. Authentication

**Login:**
```
GET ?dataset=auth&route=login&u=USERNAME&p=PASSWORD
Response: { ok:true, token:"xxx", profile:{...} }
```

**Check Session:**
```
GET ?dataset=auth&route=check&token=TOKEN
Response: { ok:true, profile:{...} }
```

#### 2. Pembimbing

**Meta (Dropdown):**
```
GET ?dataset=pembimbing&route=meta
Response: { ok:true, meta: { pembimbing: ["Nama A", ...] } }
```

**Data per Pembimbing:**
```
GET ?dataset=pembimbing&pembimbing=NAMA
Response: { ok:true, data: [{siswa,kelas,mitra}, ...] }
```

**Search Siswa:**
```
GET ?dataset=pembimbing&q=QUERY
Response: { ok:true, data: [{siswa,kelas,mitra,pembimbing}, ...] }
```

#### 3. Penguji

**Meta:**
```
GET ?dataset=penguji&route=meta
Response: { ok:true, meta: { penguji: ["Nama A", ...] } }
```

**Data per Penguji:**
```
GET ?dataset=penguji&penguji=NAMA
Response: { ok:true, data: [{siswa,kelas,mitra}, ...] }
```

**Search Siswa:**
```
GET ?dataset=penguji&q=QUERY
Response: { ok:true, data: [{siswa,kelas,mitra,penguji}, ...] }
```

#### 4. Peserta

**Meta:**
```
GET ?dataset=peserta&route=meta
Response: { ok:true, meta: { mitra: ["Mitra 1", ...] } }
```

**Data per Mitra:**
```
GET ?dataset=peserta&mitra=NAMA_MITRA
Response: { ok:true, data: [{siswa,kelas}, ...] }
```

**Search Siswa:**
```
GET ?dataset=peserta&q=QUERY
Response: { ok:true, data: [{siswa,kelas,mitra}, ...] }
```

#### 5. UKK (Dataset default)

**Meta:**
```
GET ?dataset=ukk&route=meta
GET ?route=meta  (backward compatible)
Response: { ok:true, meta: { mitra: ["Mitra 1", ...] } }
```

**Data per Mitra:**
```
GET ?dataset=ukk&mitra=NAMA_MITRA
GET ?mitra=NAMA_MITRA  (backward compatible)
Response: { ok:true, data: [{kompetensi}, ...] }
```

#### 6. Uploads (Protected)

**My Uploads (Siswa):**
```
GET ?dataset=uploads&route=my&token=TOKEN
Response: { ok:true, data: [{timestamp,category,fileId,fileName,...}, ...] }
```

**Students Uploads (Guru):**
```
GET ?dataset=uploads&route=students&token=TOKEN
Response: { ok:true, data: [{timestamp,username,nama,kelas,mitra,category,fileId,fileName,...}, ...] }
```

**Upload File (POST):**
```
POST action=upload&token=TOKEN&category=pkl&file_name=XXX&mime_type=YYY&file_b64=ZZZ
Response: HTML dengan postMessage callback
```

**Delete File (POST):**
```
POST action=delete&token=TOKEN&fileId=FILE_ID
Response: HTML dengan postMessage callback
```

#### 7. Nilai (Protected)

**Nilai Presentasi:**
```
GET ?dataset=nilaipresentasi&token=TOKEN
Response: { ok:true, data: [{username,nama,struktur,penyampaian,penguasaan,media,sikap,total,timestamp}, ...] }
```

**Nilai PKL:**
```
GET ?dataset=nilaipkl&token=TOKEN
Response: { ok:true, data: [{username,nama,total,timestamp}, ...] }
```

**Nilai UKK:**
```
GET ?dataset=nilaiukk&token=TOKEN
Response: { ok:true, data: [{username,nama,keterangan,timestamp}, ...] }
```

**Save Nilai Presentasi (POST):**
```
POST action=save_nilai&token=TOKEN&username=XXX&nama=YYY&struktur=80&penyampaian=85&...
Response: HTML dengan postMessage callback
```

#### 8. Sertifikat (Guru Only)

**List Sertifikat:**
```
GET ?dataset=sertifikat&token=TOKEN
Response: { ok:true, data: [{nama_siswa,nisn,jurusan,mitra,link,...}, ...] }
```

**Generate Sertifikat (POST):**
```
POST action=generate_sertifikat&token=TOKEN&siswa=NAMA (opsional)
Response: HTML dengan postMessage callback
```

---

## 🎓 Best Practices

### Untuk Developer

1. **Always validate token server-side**
   ```javascript
   const sess = _auth_check(token);
   if(!sess) return _json({ ok:false, error:'Sesi tidak valid' });
   ```

2. **Use JSONP untuk avoid CORS**
   ```javascript
   function _jsonp(obj, cb) {
     const body = cb ? `${cb}(${JSON.stringify(obj)})` : JSON.stringify(obj);
     return ContentService.createTextOutput(body)
       .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
   }
   ```

3. **Sanitize user input**
   ```javascript
   const _norm = v => (v == null ? '' : String(v)).trim();
   ```

4. **Log errors untuk debugging**
   ```javascript
   Logger.log('Error: ' + e.message);
   _log_notification({ status:'error', note:e.message });
   ```

### Untuk Admin

1. **Backup sebelum update major**
2. **Test di spreadsheet copy dulu**
3. **Monitor sheet NOTIFICATIONS untuk WA errors**
4. **Bersihkan data lama secara berkala**

---

## ✅ Checklist Deployment

### Pertama Kali Setup

- [ ] Duplikat template spreadsheet
- [ ] Buat 3 folder Google Drive (PKL, UKK, Sertifikat)
- [ ] Copy code-wa-fonnte.gs ke Apps Script
- [ ] Edit FOLDER_PKL_ID, FOLDER_UKK_ID, FOLDER_SERTIFIKAT_ID
- [ ] Setup FONTE_API_TOKEN (opsional)
- [ ] Deploy Apps Script sebagai Web App (Anyone)
- [ ] Copy URL deployment
- [ ] Edit config.js dengan URL deployment
- [ ] Tambahkan logo.png
- [ ] Isi sheet USERS dengan akun awal
- [ ] Isi sheet PEMBIMBING, PENGUJI, PESERTA, UKK
- [ ] Test login dengan akun siswa dan guru
- [ ] Test upload file PKL dan UKK
- [ ] Test notifikasi WhatsApp (jika diaktifkan)
- [ ] Deploy frontend ke hosting (GitHub Pages/Netlify/dll)

### Setiap Update Kode

- [ ] Backup spreadsheet
- [ ] Edit kode di Apps Script / HTML
- [ ] Save & Deploy new version (Apps Script)
- [ ] Push ke GitHub (Frontend)
- [ ] Test di browser (hard refresh Ctrl+Shift+R)
- [ ] Cek DevTools Console untuk errors
- [ ] Monitor sheet NOTIFICATIONS
- [ ] Inform users jika ada breaking changes

---

## ❓ FAQ (Pertanyaan Umum)

**Q: Apakah sistem ini gratis?**  
A: Ya, 100% gratis menggunakan tools Google (Sheets, Drive, Apps Script). Biaya hanya untuk hosting frontend (GitHub Pages gratis) dan WhatsApp API (Fonnte gratis 100 pesan/hari).

**Q: Berapa limit storage Google Drive gratis?**  
A: 15GB (shared dengan Gmail & Photos). Jika penuh, upgrade ke Google One atau hapus file lama.

**Q: Apakah bisa digunakan untuk jurusan lain (non-TKJ)?**  
A: Ya, tinggal sesuaikan data di spreadsheet (nama jurusan, mitra, kompetensi).

**Q: Bagaimana cara ganti domain?**  
A: 
1. Beli domain di Namecheap/Cloudflare
2. Setup DNS A record ke IP hosting
3. (Jika GitHub Pages) Tambahkan file CNAME berisi domain
4. Tunggu propagasi DNS (1-48 jam)

**Q: Apakah bisa multi-sekolah?**  
A: Bisa, tapi butuh modifikasi:
1. Tambahkan kolom `sekolah` di semua sheet
2. Filter data berdasarkan sekolah di backend
3. Login page dengan pilihan sekolah

**Q: Bagaimana cara backup otomatis?**  
A: Gunakan Google Takeout atau setup Apps Script trigger:
```javascript
function autoBackup() {
  const ss = SpreadsheetApp.getActive();
  const copy = ss.copy('Backup-' + new Date().toISOString());
  // Pindahkan ke folder backup
  DriveApp.getFileById(copy.getId()).moveTo(DriveApp.getFolderById('BACKUP_FOLDER_ID'));
}
// Set trigger: Edit > Current project's triggers > Add trigger > Time-driven > Week timer
```

**Q: Error "Execution exceeded maximum time"?**  
A: Terjadi jika generate sertifikat untuk banyak siswa sekaligus (>50). Solusi:
1. Generate per batch (10-20 siswa)
2. Atau optimalkan kode dengan batch operations

**Q: Bisa integrate dengan Google Classroom?**  
A: Ya, tapi butuh Google Workspace for Education dan Classroom API. Alternatif: export data siswa dari Classroom, import ke sheet PESERTA.

---

## 📚 Referensi Eksternal

- [Google Apps Script Docs](https://developers.google.com/apps-script)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Fonnte WhatsApp API](https://fonnte.com/api)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)

---

## 📜 Lisensi

Konten ini ditujukan untuk kebutuhan internal/pendidikan **TKJ SMKN 1 Telagasari**.  
Jika ingin dipublikasikan ulang, mohon cantumkan atribusi yang sesuai.

**© 2025 Sistem Informasi PKL & UKK Industri — TKJ SMKN 1 Telagasari**

---

**Dokumentasi terakhir diperbarui: 15 Januari 2025**  
**Versi Aplikasi: 2.0**  
**Backend Version: code-wa-fonnte.gs (dengan notifikasi WhatsApp)**
