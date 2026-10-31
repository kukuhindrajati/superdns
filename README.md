# SuperDNS

DNS Server untuk Memfilter/memblokir situs negatif dari daftar **Komdigi Trust Positif**, menggunakan Unbound sebagai resolver rekursif yang dilengkapi dashboard admin berbasis web, mesin DNS ini meniru perilaku dnstrust-ng komdigi yang deprecated tidak menerima update daftar block lagi.

SuperDNS tidak menggunakan RPZ untuk memblokir situs dari daftar domain komdigi yang jumlahnya sudah mencapai sekitar 9 jutaan lebih, tetapi menggunakan cara khusus yang lebih cepat di Unbound resolver dns untuk memblokir daftar domain.

**Fitur utama:**

- Memfilter situs dari daftar Trust Positif (otomatis diperbarui)
- Set interval update daftar domain trust+ komdigi
- Dashboard admin untuk mengelola aturan
- SafeSearch otomatis untuk mesin pencari
- Firewall yang mengamankan server
- Halaman blokir
- Whitelist domain
- Local DNS
- T-Proxy DNS (Menerima lalu lintas DNS yang dialihkan oleh router melalui TPROXY)
- DNSSEC
- ACL / Access control list pelanggan
- DNS inspector
- Activity log
- Pembaruan CDB dengan hot-remap tanpa reload resolver, sehingga cache, uptime,
  dan statistik kumulatif tetap terjaga

## Syarat (Sebelum Instalasi)

**OS**

- Debian 12 (bookworm) versi 64-bit (x86_64)
- Server dijalankan sebagai **root**
- Berjalan pada bare metal atau VM VMware, KVM/Proxmox, Hyper-V, dan
  VirtualBox. Guest agent hypervisor bersifat opsional dan tidak dibutuhkan
  oleh DNS.
- Untuk container/LXC, `nftables` wajib bisa dipakai dan container harus
  mempunyai capability `NET_ADMIN`.

**Dependensi yang harus sudah terpasang** di server:

| Paket                | Fungsi                                |
| -------------------- | ------------------------------------- |
| `systemd`            | Menjalankan layanan otomatis          |
| `openssh-server`     | Akses SSH                             |
| `nftables`           | Firewall                              |
| `unbound-anchor`     | Keamanan DNSSEC                       |
| `dnsutils`           | Alat tes DNS (`dig`)                  |
| `curl` dan `openssl` | Download & sertifikat                 |
| `git`                | Untuk clone repository                |
| `nodejs` dan `npm`   | Runtime & build Custom Dashboard (TS) |

Cara menginstal dependensi di Debian:

```sh
apt update
apt install -y systemd openssh-server nftables unbound-anchor \
    dnsutils curl openssl ca-certificates libevent-2.1-7 git nodejs npm
```

> Catatan: `blcreate`, `unbound`, dan `dnstrust-admin` sudah disertakan dalam project ini, tidak perlu diinstal manual.

## Cara Install

### 1. Ambil Project

Bisa lewat `git clone`:

```sh
git clone https://github.com/kukuhindrajati/superdns
cd superdns
```

Atau salin folder project ini ke server (misalnya `/root/superdns`), lalu masuk ke folder tersebut.

### 2. Jalankan Installer

Sebagai root:

```sh
./install.sh
```

1. Akan diminta **password dashboard** (minimal 12 karakter). Kosongkan saja jika ingin dibuatkan password acak.
2. Tunggu sampai muncul pesan:

   ```
   DNS Trust installation completed successfully.
   Dashboard: https://<IP-server>:9080/
   ```

Instalasi selesai. Server DNS langsung aktif dan dashboard bisa dibuka.

Installer tidak mengubah target boot, console/getty, atau guest agent. Pada
VMware, `open-vm-tools` boleh dipasang untuk integrasi hypervisor tetapi bukan
syarat SuperDNS. Pada KVM/Proxmox hal yang sama berlaku untuk
`qemu-guest-agent`.

Jika `/etc/nftables.conf` sudah ada, installer mempertahankan file tersebut.
Pada sistem fresh tanpa file itu, template SuperDNS hanya disalin. Installer
tidak mengaktifkan, mematikan, atau me-reload firewall host. Pastikan firewall
milik server mengizinkan UDP/TCP 53, TCP 9080, serta SSH dari jaringan
administrator.

## Cara Menggunakan

### Dashboard Admin

Buka di browser: `https://<IP-server>:9080/`

- Login dengan password yang dimasukkan saat instalasi.
- Peringatan sertifikat di browser bisa dilewati (klik **Advanced → Continue**).

### Cek Apakah DNS Berjalan

Dari server:

```sh
systemctl is-active dnstrust-unbound
# hasil: active
```

### Status dan Layanan

| Perintah                                             | Fungsi                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `systemctl status dnstrust-unbound`                  | Status server DNS                               |
| `systemctl status dnstrust-admin`                    | Status dashboard                                |
| `systemctl status unbound-blacklist-update.timer`    | Status pembaruan daftar blokir                  |
| `sudo /usr/local/sbin/dnstrust-admin reload`         | Reload dashboard                                |
| `sudo /usr/local/sbin/dnstrust-admin reset-password` | Reset password dashbaord                        |
| `sudo /usr/local/sbin/verify-dnstrust-hot-remap`     | Verifikasi pergantian CDB tanpa reload resolver |

Daftar situs blokir diperbarui otomatis sesuai pengaturan interval.

Semua pengecualian domain, termasuk kebutuhan operator/internal, dikelola dari
satu halaman **Whitelist**. Saat upgrade dari versi yang masih memakai Local
overrides, installer otomatis menggabungkan isinya ke Whitelist sebelum
menghapus file konfigurasi lama.

Ketika sumber Komdigi berubah, updater membangun CDB baru dan menggantinya
secara atomik. Worker Unbound mendeteksi inode baru dan melakukan hot-remap;
proses Unbound tidak di-reload dan statistik tidak direset. Perintah verifikasi
di atas aman dijalankan setelah instalasi atau upgrade karena menggunakan
salinan CDB dengan isi identik, bukan mengubah daftar blokir.

### Panduan Singkat nftables

Server dilindungi firewall **nftables**. Secara default hanya port berikut yang dibuka untuk jaringan privat (10/8, 172.16/12, 192.168/16):

| Port | Layanan         |
| ---- | --------------- |
| 53   | DNS (UDP & TCP) |
| 22   | SSH             |
| 9080 | Dashboard       |

#### Melihat aturan yang aktif

```sh
nft list ruleset
```

#### Menambah port yang diizinkan

File aturan ada di `/etc/nftables.conf`. Contoh membuka port 80:

1. Buka file:

   ```sh
   nano /etc/nftables.conf
   ```

2. Tambahkan baris di bagian `chain input` (di samping aturan `tcp dport 9080`):

   ```
   ip saddr @ssh_admins_v4 tcp dport 80 accept
   ```

3. Simpan, lalu terapkan:

   ```sh
   systemctl restart nftables
   ```

4. Cek apakah sudah aktif:

   ```sh
   nft list chain inet filter input
   ```

> Perhatian: aturan `policy drop` membuat semua koneksi lain ditolak. Pastikan port SSH (22) dan DNS (53) tidak dihapus dari file, dan selalu tes dari terminal lain sebelum meninggalkan sesi SSH.

## Cara Update Otomatis (1 Langkah)

Cukup jalankan satu perintah ini setiap kali ingin menarik pembaruan terbaru dari GitHub:

```sh
./update.sh
```

Script `./update.sh` akan otomatis melakukan:
1. `git pull origin main` untuk mengunduh kode terbaru.
2. Memperbarui core resolver dan systemd service.
3. Otomatis menjalankan `npm install` dan `npm run build` untuk Custom Dashboard (TypeScript).
4. Otomatis merestart service dashboard tanpa perlu perintah terpisah.

---

## Cara Menghapus (Uninstall)

```sh
./uninstall.sh
```

Ketik `REMOVE DNS TRUST` saat diminta konfirmasi. Semua data lama di-backup ke `/var/backups/` sebelum dihapus.

## Tes Instalasi di Docker (Opsional)

Bisa dicoba dulu tanpa server fisik:

```sh
./test/docker/test.sh
```

Script ini menyalakan server uji, menjalankan instalasi, lalu memeriksa hasilnya secara otomatis.
