/**
 * JASTIP WEB - MAIN JS
 * Terintegrasi dengan Supabase Asli (Aman dari Crash)
 */

const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

// Inisialisasi SDK Supabase dengan pengecekan aman
let supabase = null;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Gagal memuat Supabase dari CDN. Pastikan internet stabil.");
}

const app = {
    state: {
        currentMerchant: null,
        userLocation: null,
        merchants: [],
        shippingRatePerKm: 2500,
        adminFee: 2000,
        adminWA: '6281234567890',
        isAuth: false
    },

    async init() {
        if (window.lucide) lucide.createIcons();
        this.setupNavigation();
        this.setupFormListeners();
        
        // Ambil data dari Supabase jika koneksi berhasil
        if (supabase) {
            await this.loadSettings();
            await this.loadMerchants();
        } else {
            document.getElementById('merchant-list').innerHTML = '<p class="text-center text-muted mt-3">Koneksi Database Terputus.</p>';
        }
    },

    // --- NAVIGATION ---
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.getAttribute('data-target');
                this.navigate(target);
            });
        });
    },

    navigate(viewId) {
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewId}`);
        if(targetView) targetView.classList.add('active');

        if (['home', 'pesanan', 'member'].includes(viewId)) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
            if(activeNav) activeNav.classList.add('active');
        }

        const titles = { 'home': 'Jastip Web', 'pesanan': 'Pesanan Saya', 'member': 'Member Area' };
        if (titles[viewId]) document.getElementById('header-title').innerText = titles[viewId];
        
        // Perbaikan Scroll ke atas khusus untuk SPA
        document.querySelector('.app-content').scrollTo(0, 0);
    },

    // --- SUPABASE DATA FETCHING ---
    async loadSettings() {
        try {
            const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
            if (data) {
                this.state.shippingRatePerKm = data.ongkir || 2500;
                this.state.adminFee = data.adminFee || 2000;
                this.state.adminWA = data.wa || '6281234567890';
            }
        } catch (err) {
            console.log("Menggunakan pengaturan default.");
        }
    },

    async loadMerchants() {
        try {
            const { data: banners } = await supabase.from('banners').select('*');
            if(banners && banners.length > 0) {
                const bannerContainer = document.querySelector('.banner-slider');
                bannerContainer.innerHTML = banners.map(b => `<img src="${b.url}" alt="Banner" class="banner" style="width:100%; border-radius:12px; height:150px; object-fit:cover;">`).join('');
            }

            const { data: merchants, error } = await supabase.from('merchants').select('*').eq('status', 'Aktif');
            if (error) throw error;
            
            this.state.merchants = merchants || [];
            const container = document.getElementById('merchant-list');
            
            if(this.state.merchants.length === 0) {
                container.innerHTML = '<p class="text-center text-muted mt-3">Belum ada merchant tersedia.</p>';
                return;
            }

            container.innerHTML = this.state.merchants.map(m => `
                <div class="merchant-card" onclick="app.openMerchant(${m.id})">
                    <img src="${m.img}" alt="${m.name}" class="merchant-img">
                    <div class="merchant-content">
                        <h3>${m.name}</h3>
                        <div class="text-sm text-muted mb-2">${m.category}</div>
                        <div class="info-badges">
                            <span class="badge"><i data-lucide="clock"></i> ${m.hours ? m.hours.split(' - ')[0] : 'Buka'}</span>
                        </div>
                    </div>
                </div>
            `).join('');
            
            if (window.lucide) lucide.createIcons();
        } catch (error) {
            this.showToast('Gagal memuat daftar merchant.');
            console.error(error);
        }
    },

    openMerchant(id) {
        const m = this.state.merchants.find(x => x.id === id);
        this.state.currentMerchant = m;
        
        document.getElementById('detail-image').src = m.img;
        document.getElementById('detail-name').innerText = m.name;
        document.getElementById('detail-desc').innerText = m.desc || 'Tersedia di Jastip Web';
        document.getElementById('detail-hours').innerText = m.hours || '-';

        this.navigate('merchant');
        this.calculateInvoice();
    },

    // --- FORM & CALCULATION ---
    setupFormListeners() {
        const container = document.getElementById('order-items-container');
        if(container) container.addEventListener('input', () => this.calculateInvoice());
        
        const form = document.getElementById('order-form');
        if(form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processOrder();
            });
        }
    },

    addOrderItemRow() {
        const row = document.createElement('div');
        row.className = 'order-item-row';
        row.innerHTML = `
            <input type="text" placeholder="Nama Makanan" class="item-name" required>
            <input type="number" placeholder="Harga" class="item-price" required>
            <input type="number" placeholder="Qty" class="item-qty" required min="1">
        `;
        document.getElementById('order-items-container').appendChild(row);
    },

    getLocation() {
        const status = document.getElementById('location-status');
        status.innerText = "Mencari lokasi...";
        if (!navigator.geolocation) {
            status.innerText = "Geolocation tidak didukung browser ini.";
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                status.innerText = "Titik lokasi berhasil diamankan.";
                status.style.color = "green";
                this.calculateInvoice();
            },
            (err) => {
                status.innerText = "Gagal mengambil lokasi. Pastikan GPS aktif.";
                status.style.color = "red";
            },
            { enableHighAccuracy: true }
        );
    },

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    calculateInvoice() {
        const rows = document.querySelectorAll('.order-item-row');
        let subtotalUntung = 0; 
        let itemsHtml = '';

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value || '-';
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const qty = parseInt(row.querySelector('.item-qty').value) || 0;
            const untung = price * qty;
            
            if (name !== '-' || price > 0) {
                subtotalUntung += untung;
                itemsHtml += `
                    <div class="row-data">
                        <span>${name}</span>
                        <span>${price.toLocaleString('id-ID')}</span>
                        <span>x${qty}</span>
                        <span>${untung.toLocaleString('id-ID')}</span>
                    </div>
                `;
            }
        });

        document.getElementById('invoice-items').innerHTML = itemsHtml;

        let distance = 0;
        let shipping = 0;
        if (this.state.userLocation && this.state.currentMerchant) {
            distance = this.haversineDistance(
                this.state.userLocation.lat, this.state.userLocation.lng,
                this.state.currentMerchant.lat, this.state.currentMerchant.lng
            );
            shipping = Math.ceil(distance) * this.state.shippingRatePerKm;
        }

        document.getElementById('summary-distance').innerText = `${distance.toFixed(1)} km`;
        document.getElementById('detail-distance').innerText = `${distance.toFixed(1)} km`;
        document.getElementById('summary-shipping').innerText = `Rp ${shipping.toLocaleString('id-ID')}`;
        
        const adminFeeLabel = document.querySelector('.summary-row:nth-last-child(3) span:last-child');
        if(adminFeeLabel) adminFeeLabel.innerText = `Rp ${this.state.adminFee.toLocaleString('id-ID')}`;

        this.state.currentGrandTotal = subtotalUntung + shipping + this.state.adminFee;
        document.getElementById('summary-total').innerText = `Rp ${this.state.currentGrandTotal.toLocaleString('id-ID')}`;
    },

    async processOrder() {
        if (!this.state.userLocation) {
            this.showToast("Harap ambil titik lokasi Anda terlebih dahulu.");
            return;
        }

        const btnSubmit = document.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Memproses...";

        try {
            const name = document.getElementById('order-name').value;
            const wa = document.getElementById('order-wa').value;
            const address = document.getElementById('order-address').value;
            const notes = document.getElementById('order-notes').value;
            const payment = document.querySelector('input[name="payment"]:checked').value;
            
            const orderId = 'ORD-' + Math.floor(Math.random() * 900000 + 100000);
            const dateStr = new Date().toISOString().split('T')[0];

            if(supabase) {
                const orderPayload = {
                    id: orderId,
                    date: dateStr,
                    customer: name,
                    merchant: this.state.currentMerchant.name,
                    total: this.state.currentGrandTotal,
                    status: 'Menunggu'
                };
                const { error } = await supabase.from('orders').insert([orderPayload]);
                if(error) throw error;
            }

            const rows = document.querySelectorAll('.order-item-row');
            let orderList = '';
            rows.forEach(row => {
                const n = row.querySelector('.item-name').value;
                const p = row.querySelector('.item-price').value;
                const q = row.querySelector('.item-qty').value;
                if(n && p && q) {
                    orderList += `- ${n} | Rp${p} | Qty:${q} | Untung: Rp${p*q}%0A`;
                }
            });

            const textWa = `*ORDER BARU - JASTIP WEB*%0A%0A` +
                `*ID Pesanan:* ${orderId}%0A` +
                `*Merchant:* ${this.state.currentMerchant.name}%0A` +
                `*Pemesan:* ${name}%0A` +
                `*WA:* ${wa}%0A` +
                `*Alamat:* ${address}%0A` +
                `*Link Map:* https://www.google.com/maps?q=${this.state.userLocation.lat},${this.state.userLocation.lng}%0A%0A` +
                `*Pesanan:*%0A${orderList}%0A` +
                `*Catatan:* ${notes || '-'}%0A` +
                `*Pembayaran:* ${payment}%0A` +
                `*Total Tagihan:* Rp ${this.state.currentGrandTotal.toLocaleString('id-ID')}%0A%0A` +
                `_Mohon segera diproses._`;

            this.showToast("Pesanan berhasil dibuat! Membuka WhatsApp...");
            
            setTimeout(() => {
                document.getElementById('order-form').reset();
                this.navigate('home');
                window.open(`https://wa.me/${this.state.adminWA}?text=${textWa}`, '_blank');
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Buat Pesanan";
            }, 1500);

        } catch(error) {
            this.showToast("Gagal membuat pesanan.");
            console.error(error);
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Buat Pesanan";
        }
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    toggleAuthMode() {
        this.showToast("Fitur otentikasi menunggu setup Auth Supabase.");
    },

    logout() {
        this.state.isAuth = false;
        document.getElementById('auth-profile').classList.add('hidden');
        document.getElementById('auth-login').classList.remove('hidden');
        this.showToast("Berhasil keluar.");
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());