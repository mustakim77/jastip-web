/**
 * JASTIP WEB - MAIN JS
 * Requirement: ES6, Supabase, Vanilla JS
 */

// Konfigurasi Supabase (Harus diganti dengan Credentials Project Anda)
const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

// Inisialisasi SDK (Hanya diaktifkan jika kredensial sudah dimasukkan)
// const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
    state: {
        currentMerchant: null,
        userLocation: null,
        cart: [],
        shippingRatePerKm: 2500, // Tarif per km
        adminFee: 2000,
        adminWA: '6281234567890', // Default admin WA
        isAuth: false
    },

    init() {
        lucide.createIcons();
        this.setupNavigation();
        this.loadMockMerchants();
        this.setupFormListeners();
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
        // Update Views
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // Update Bottom Nav Styling (jika dari bottom nav)
        if (['home', 'pesanan', 'member'].includes(viewId)) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelector(`.nav-item[data-target="${viewId}"]`).classList.add('active');
        }

        // Header Title
        const titles = { 'home': 'Jastip Web', 'pesanan': 'Pesanan Saya', 'member': 'Member Area' };
        if (titles[viewId]) document.getElementById('header-title').innerText = titles[viewId];
        
        window.scrollTo(0,0);
    },

    // --- MOCK DATA FOR PHASE 1 ---
    loadMockMerchants() {
        const merchants = [
            { id: 1, name: 'Sate Ayam Ponorogo', category: 'Makanan', rating: 4.8, open: '10:00 - 22:00', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400', lat: -7.868, lng: 111.464, desc: 'Sate ayam khas asli Ponorogo.' },
            { id: 2, name: 'Boba Time', category: 'Minuman', rating: 4.5, open: '09:00 - 21:00', img: 'https://images.unsplash.com/photo-1558857563-b37102e9976c?w=400', lat: -7.870, lng: 111.465, desc: 'Minuman boba segar aneka rasa.' }
        ];

        const container = document.getElementById('merchant-list');
        container.innerHTML = merchants.map(m => `
            <div class="merchant-card" onclick="app.openMerchant(${m.id})">
                <img src="${m.img}" alt="${m.name}" class="merchant-img">
                <div class="merchant-content">
                    <h3>${m.name}</h3>
                    <div class="text-sm text-muted mb-2">${m.category}</div>
                    <div class="info-badges">
                        <span class="badge"><i data-lucide="star"></i> ${m.rating}</span>
                        <span class="badge"><i data-lucide="clock"></i> ${m.open.split(' - ')[0]}</span>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
        this.state.merchants = merchants;
    },

    openMerchant(id) {
        const m = this.state.merchants.find(x => x.id === id);
        this.state.currentMerchant = m;
        
        document.getElementById('detail-image').src = m.img;
        document.getElementById('detail-name').innerText = m.name;
        document.getElementById('detail-desc').innerText = m.desc;
        document.getElementById('detail-hours').innerText = m.open;

        this.navigate('merchant');
        this.calculateInvoice();
    },

    // --- FORM & CALCULATION ---
    setupFormListeners() {
        const container = document.getElementById('order-items-container');
        container.addEventListener('input', () => this.calculateInvoice());
        
        document.getElementById('order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processOrder();
        });
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
        // Parse items
        const rows = document.querySelectorAll('.order-item-row');
        let subtotalUntung = 0; // Kolom untung per instruksi spesifik (Total = Untung di form)
        let itemsHtml = '';

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value || '-';
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const qty = parseInt(row.querySelector('.item-qty').value) || 0;
            const untung = price * qty;
            subtotalUntung += untung;

            if (name !== '-' || price > 0) {
                // Layout kolom: Item | Harga | Qty | Untung
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

        // Calculate Distance
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

        const grandTotal = subtotalUntung + shipping + this.state.adminFee;
        document.getElementById('summary-total').innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    },

    // --- CHECKOUT & WHATSAPP ---
    processOrder() {
        if (!this.state.userLocation) {
            this.showToast("Harap ambil titik lokasi Anda terlebih dahulu.");
            return;
        }

        // Kumpulkan data
        const name = document.getElementById('order-name').value;
        const wa = document.getElementById('order-wa').value;
        const address = document.getElementById('order-address').value;
        const notes = document.getElementById('order-notes').value;
        const payment = document.querySelector('input[name="payment"]:checked').value;
        const total = document.getElementById('summary-total').innerText;

        // Kumpulkan item
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
            `*Merchant:* ${this.state.currentMerchant.name}%0A` +
            `*Pemesan:* ${name}%0A` +
            `*WA:* ${wa}%0A` +
            `*Alamat:* ${address}%0A` +
            `*Link Map:* https://www.google.com/maps?q=${this.state.userLocation.lat},${this.state.userLocation.lng}%0A%0A` +
            `*Pesanan:*%0A${orderList}%0A` +
            `*Catatan:* ${notes || '-'}%0A` +
            `*Pembayaran:* ${payment}%0A` +
            `*Total Tagihan:* ${total}%0A%0A` +
            `_Mohon segera diproses._`;

        // Simulasi Supabase insert di sini sebelum WA
        // await supabase.from('orders').insert([...])

        this.showToast("Pesanan dibuat! Membuka WhatsApp...");
        setTimeout(() => {
            window.open(`https://wa.me/${this.state.adminWA}?text=${textWa}`, '_blank');
            this.navigate('home');
        }, 1500);
    },

    // --- UTILS ---
    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    toggleAuthMode() {
        this.showToast("Fitur otentikasi akan disambungkan pada panel Supabase penuh.");
    },

    logout() {
        this.state.isAuth = false;
        document.getElementById('auth-profile').classList.add('hidden');
        document.getElementById('auth-login').classList.remove('hidden');
        this.showToast("Berhasil keluar.");
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => app.init());