# Blogger Auto Post

Script Node.js untuk **generate konten blog otomatis** menggunakan Google Gemini AI dan **publish langsung ke Blogger** melalui fitur kirim email.

## Fitur

- 🤖 Generate konten blog menggunakan **Google Gemini 2.5 Flash**
- 🖼️ Otomatis cari thumbnail dari **Pexels API**
- 📧 Publish ke **Blogger** melalui fitur posting via email
- ⏰ **Cron job bawaan** — jalan otomatis setiap hari
- 🚀 Bisa dijalankan via **GitHub Actions** (otomatis setiap hari)
- 📦 Standalone — cukup clone repo ini dan jalankan

## Prasyarat

- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- Akun Google dengan [Gemini API key](https://aistudio.google.com/apikey)
- Akun [Pexels](https://www.pexels.com/api/new/) untuk API key gambar (opsional)
- Akun email (Gmail disarankan) untuk mengirim email ke Blogger
- Blog di [Blogger](https://www.blogger.com/) dengan fitur **posting via email** aktif

## Instalasi

```bash
# 1. Clone repository
git clone https://github.com/eabdalmufid/blogger-auto-post.git
cd blogger-auto-post

# 2. Install dependencies
npm install

# 3. Salin file konfigurasi dan isi dengan data Anda
cp .env.example .env
```

## Konfigurasi

Edit file `.env` dengan data Anda:

```env
# Alamat email posting Blogger
# Dapatkan di: Blogger > Settings > Email > Posting using email
BLOGGER_EMAIL=yourname.secretcode@blogger.com

# Google Gemini API key
# Dapatkan di: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key

# Pexels API key (opsional, untuk thumbnail gambar)
# Dapatkan di: https://www.pexels.com/api/new/
PEXELS_API_KEY=your_pexels_api_key

# SMTP untuk kirim email (contoh Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=emailanda@gmail.com
SMTP_PASS=your_app_password

# Kategori blog (pisahkan dengan koma)
BLOG_CATEGORIES=technology,lifestyle,health

# Jumlah kata per artikel
BLOG_WORDS=1200

# Custom prompt (opsional)
BLOG_PROMPT=

# Jadwal cron (default: setiap hari jam 07:00)
CRON_SCHEDULE=0 7 * * *
```

### Cara Mendapatkan SMTP Password (Gmail)

1. Buka [Google Account](https://myaccount.google.com/)
2. Aktifkan **2-Step Verification**
3. Buka [App Passwords](https://myaccount.google.com/apppasswords)
4. Pilih **Mail** → **Other** → ketik "Blogger Auto Post"
5. Copy password yang muncul dan paste ke `SMTP_PASS`

### Cara Aktifkan Posting via Email di Blogger

1. Buka [Blogger](https://www.blogger.com/)
2. Pilih blog Anda
3. Pergi ke **Settings** → **Email**
4. Di bagian **Posting using email**, aktifkan dan catat alamat emailnya
5. Paste alamat tersebut ke `BLOGGER_EMAIL` di file `.env`

## Cara Pakai

### Jalankan Sekali (Generate 1 Artikel)

```bash
npm run generate
```

### Jalankan dengan Cron Scheduler (Otomatis Setiap Hari)

```bash
npm start
```

Script akan:
1. Langsung generate 1 artikel saat pertama dijalankan
2. Kemudian jalan otomatis sesuai jadwal di `CRON_SCHEDULE`
3. Default: setiap hari jam 07:00

### Jalankan di Background (Linux/Mac)

```bash
# Jalankan di background dengan nohup
nohup npm start > blogger.log 2>&1 &

# Cek log
tail -f blogger.log

# Untuk menghentikan, cari PID dan kill
ps aux | grep "node index.js"
kill <PID>
```

### Jalankan dengan PM2 (Disarankan untuk Produksi)

```bash
# Install PM2
npm install -g pm2

# Jalankan
pm2 start index.js --name blogger-auto-post

# Cek status
pm2 status

# Lihat log
pm2 logs blogger-auto-post

# Auto-start saat reboot
pm2 startup
pm2 save
```

## Cara Kerja

```
┌─────────────────────────────────────────────────┐
│                 CRON SCHEDULER                  │
│            (setiap hari jam 07:00)              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  [1] Generate 3 Outline                         │
│      → Gemini AI membuat 3 outline blog post    │
│      → Pilih 1 secara random                    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  [2] Generate Full Article                      │
│      → Gemini AI membuat artikel lengkap        │
│      → Format markdown + SEO keywords           │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  [3] Search Thumbnail                           │
│      → Pexels API mencari gambar landscape      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  [4] Kirim Email ke Blogger                     │
│      → Subject = Judul artikel                  │
│      → Body = Konten HTML + thumbnail           │
│      → Blogger auto-publish dari email          │
└─────────────────────────────────────────────────┘
```

## Jalankan via GitHub Actions

Repo ini sudah dilengkapi workflow GitHub Actions (`.github/workflows/daily-blog.yml`) yang jalan **otomatis setiap hari jam 07:00 UTC**.

### Setup GitHub Actions:

1. Buka repo di GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Tambahkan **Repository secrets** berikut:

| Secret | Deskripsi |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `PEXELS_API_KEY` | Pexels API key (opsional) |
| `BLOGGER_EMAIL` | Alamat email posting Blogger |
| `SMTP_HOST` | SMTP host (misal: `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (misal: `465`) |
| `SMTP_USER` | Email pengirim |
| `SMTP_PASS` | App password email pengirim |

3. (Opsional) Tambahkan **Repository variables**:

| Variable | Deskripsi | Default |
|---|---|---|
| `BLOG_CATEGORIES` | Kategori blog | `technology,lifestyle,health` |
| `BLOG_WORDS` | Jumlah kata per artikel | `1200` |
| `BLOG_PROMPT` | Custom prompt | _(kosong)_ |

4. Workflow akan jalan otomatis setiap hari, atau bisa di-trigger manual dari tab **Actions** → **Daily Blog Generator** → **Run workflow**

## Struktur Folder

```
├── .github/workflows/
│   └── daily-blog.yml  # GitHub Actions workflow (jalan harian)
├── index.js            # Entry point dengan cron scheduler
├── generate.js         # Logic generate blog + kirim email
├── package.json        # Dependencies (nodemailer, node-cron)
├── .env.example        # Template konfigurasi
├── .env                # Konfigurasi Anda (jangan di-commit!)
└── README.md           # Dokumentasi ini
```

## Contoh Format Cron

| Schedule | Deskripsi |
|---|---|
| `0 7 * * *` | Setiap hari jam 07:00 |
| `0 */6 * * *` | Setiap 6 jam |
| `0 9 * * 1-5` | Senin–Jumat jam 09:00 |
| `0 8,20 * * *` | Jam 08:00 dan 20:00 |
| `*/30 * * * *` | Setiap 30 menit |
