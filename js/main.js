/**
 * JASTIP WEB - MAIN JS (Full Cart, Merchant Menus & GPS Distance Calculation)
 */

const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
    state: {
        merchants: [],
        currentMerchant: null,
        userLocation: null,
        shipping_rate_per_km: null, // Sesuai kolom database
        service_fee: 1000,          // Sesuai kolom database
        admin_whatsapp: "6281234567890", // Sesuai kolom database
        calculatedGrandTotal: 0
    },
    
    // Keranjang Pesanan (Cart)
    cart: [],

    async init() {
        await this.loadSettings();
        this.loadMerchants();
        await this.loadBanners();
        this.setupEventListeners();
        this.checkAuthSession();
        this.updateMemberUI();
        this.updateCartBadge();
    },

    // --- 1. MANAJEMEN KERANJANG (CART) & PESANAN ---

    addToCart(item, merchantName) {
        // Cek apakah item sudah ada di keranjang
        const existing = this.cart.find(i => i.name === item.name && i.merchantName === merchantName);
        if (existing) {
            existing.qty = (existing.qty || 1) + 1;
        } else {
            this.cart.push({ ...item, merchantName, qty: 1 });
        }
        
        this.showToast('✅ Berhasil ditambahkan ke pesanan');
        this.updateCartBadge();
    },

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.renderOrderPage();
        this.updateCartBadge();
        this.showToast('Item dihapus dari pesanan');
    },

    updateCartBadge() {
        const badge = document.getElementById('cartBadge');
        if (!badge) return;
        
        if (this.cart.length > 0) {
            badge.innerText = this.cart.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    },

    renderOrderPage() {
        const container = document.getElementById('orderHistoryContainer');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fa-solid fa-basket-shopping text-muted fs-1 mb-2 opacity-50"></i>
                    <p class="text-muted small mb-0">Belum ada pesanan dari stan.</p>
                    <a href="javascript:void(0)" onclick="app.clearAndGoHome()" class="btn btn-sm btn-primary mt-3 rounded-pill px-4">Pilih Makanan Sekarang</a>
                </div>`;
            return;
        }

        let subtotal = this.cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0);

        container.innerHTML = `
            <div class="mb-3">
                ${this.cart.map((item, index) => `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                        <div>
                            <h6 class="fw-bold mb-0 text-dark" style="font-size: 0.9rem;">${item.name}</h6>
                            <small class="text-muted">Stan: ${item.merchantName || 'Umum'} | Qty: ${item.qty || 1}</small>
                        </div>
                        <div class="text-end">
                            <span class="fw-bold text-primary small">Rp ${(item.price * (item.qty || 1)).toLocaleString('id-ID')}</span>
                            <button type="button" class="btn btn-sm text-danger p-0 ms-3" onclick="app.removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="bg-light p-3 rounded-3 mb-3">
                <div class="d-flex justify-content-between fw-bold text-dark">
                    <span>Subtotal Menu:</span>
                    <span>Rp ${subtotal.toLocaleString('id-ID')}</span>
                </div>
            </div>
            <button type="button" class="btn btn-success w-100 rounded-pill fw-semibold py-2 shadow-sm" onclick="app.goToCheckout()">
                Lanjut Pilih Stan & Checkout <i class="fa-solid fa-arrow-right ms-1"></i>
            </button>
        `;
    },

    goToCheckout() {
        if (this.cart.length === 0) {
            this.showToast('Keranjang pesanan masih kosong');
            return;
        }
        // Ambil merchant dari item pertama di keranjang
        const firstItem = this.cart[0];
        const merchant = this.state.merchants.find(m => (m.nama || m.name) === firstItem.merchantName);
        
        if (merchant) {
            this.openMerchantDetail(merchant.id);
        } else {
            this.clearAndGoHome();
        }
    },

    // --- 2. DETAIL MERCHANT & MENU ---
    async openMerchantDetail(id) {
        try {
            const merchant = this.state.merchants.find(m => m.id == id);
            if (!merchant) {
                this.showToast('Merchant tidak ditemukan');
                return;
            }
            this.state.currentMerchant = merchant;

            // Pengaman elemen DOM detail merchant
            const imgEl = document.getElementById('detailMerchantImg');
            const nameEl = document.getElementById('detailMerchantName');
            const descEl = document.getElementById('detailMerchantDesc');
            const hoursEl = document.getElementById('detailMerchantHours');

            if (imgEl) imgEl.src = merchant.foto || merchant.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600';
            if (nameEl) nameEl.innerText = merchant.nama || merchant.name || 'Stan Jastip';
            if (descEl) descEl.innerText = merchant.alamat || merchant.desc || 'Stan terpercaya pilihan Jastip Web.';
            if (hoursEl) hoursEl.innerText = `Buka: ${merchant.jam_buka || merchant.hours || '08:00 - 21:00'}`;

            // Muat menu produk stan secara aman
            await this.loadMerchantMenus(id);

            // Sembunyikan view lain dan tampilkan detailView
            const homeView = document.getElementById('homeView');
            const searchView = document.getElementById('searchView');
            const pesananView = document.getElementById('pesananView');
            const memberView = document.getElementById('memberView');
            const detailView = document.getElementById('detailView');

            if (homeView) homeView.style.display = 'none';
            if (searchView) searchView.classList.add('d-none');
            if (pesananView) pesananView.style.display = 'none';
            if (memberView) memberView.style.display = 'none';
            
            if (detailView) {
                detailView.classList.remove('d-none');
                detailView.style.display = 'block';
            }

            const backBtn = document.getElementById('backToHomeBtn');
            if (backBtn) backBtn.classList.remove('d-none');

            window.scrollTo(0, 0);
            this.calculateInvoice();
        } catch (err) {
            console.error('Error openMerchantDetail:', err);
            this.showToast('Gagal memuat detail stan');
        }
    },

    async loadMerchantMenus(merchantId) {
        const menuContainer = document.getElementById('orderItemsContainer');
        if (!menuContainer) return;

        try {
            const { data: products, error } = await dbClient
                .from('products')
                .select('*')
                .eq('merchant_id', merchantId);

            if (error) {
                // Jika tabel products belum ada di Supabase, sediakan form input manual
                this.renderManualMenuInput(menuContainer);
                return;
            }

            if (!products || products.length === 0) {
                menuContainer.innerHTML = `
                    <p class="text-muted small text-center py-3">Belum ada menu makanan yang diunggah oleh stan ini.</p>`;
                return;
            }

            const merchantName = document.getElementById('detailMerchantName')?.innerText || 'Stan';

            menuContainer.innerHTML = products.map((prod) => `
                <div class="d-flex align-items-center justify-content-between p-2 border-bottom mb-2 bg-white rounded-3 shadow-sm">
                    <div>
                        <h6 class="fw-bold mb-1" style="font-size: 0.9rem;">${prod.name || prod.nama}</h6>
                        <span class="text-primary fw-semibold small">Rp ${Number(prod.price || prod.harga).toLocaleString('id-ID')}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary rounded-pill px-3" 
                        onclick='app.addToCart(${JSON.stringify({ name: prod.name || prod.nama, price: prod.price || prod.harga })}, "${merchantName}")'>
                        <i class="fa-solid fa-plus me-1"></i> Pilih
                    </button>
                </div>
            `).join('');

        } catch (err) {
            console.error('Error loadMerchantMenus:', err);
            this.renderManualMenuInput(menuContainer);
        }
    },

    addOrderItemRow() {
        const container = document.getElementById('orderItemsContainer');
        const row = document.createElement('div');
        row.className = 'row g-2 mb-2 order-item-row';
        row.innerHTML = `
            <div class="col-6"><input type="text" class="form-control item-name" placeholder="Nama Menu" required></div>
                <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" required></div>
                <div class="col-4"><input type="number" class="form-control item-price" placeholder="Harga" required></div>
        `;
        container.appendChild(row);
    },

    renderManualMenuInput(container) {
        container.innerHTML = `
            <div class="row g-2 mb-2 order-item-row">
                <div class="col-6"><input type="text" class="form-control item-name" placeholder="Nama Menu" required></div>
                <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" required></div>
                <div class="col-4"><input type="number" class="form-control item-price" placeholder="Harga" required></div>
            </div>`;
    },

    // --- 3. GPS, HAVERSINE & PROSES CHECKOUT ---

    getLocation() {
        const status = document.getElementById('locationStatus');
        if (status) status.innerText = "Mencari lokasi GPS Anda...";
        
        if (!navigator.geolocation) {
            if (status) status.innerText = "GPS tidak didukung browser.";
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if (status) {
                    status.innerText = "Lokasi GPS berhasil diamankan!";
                    status.style.color = "green";
                }
                this.calculateInvoice();
            },
            () => {
                if (status) {
                    status.innerText = "Gagal mengambil lokasi GPS.";
                    status.style.color = "red";
                }
            },
            { enableHighAccuracy: true }
        );
    },

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius bumi dalam kilometer
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    },

    calculateInvoice() {
        let distance = 0;
        let shipping = 0;

        if (this.state.userLocation && this.state.currentMerchant) {
            const stanLat = Number(this.state.currentMerchant.latitude || this.state.currentMerchant.lat);
            const stanLng = Number(this.state.currentMerchant.longitude || this.state.currentMerchant.lng);

            if (!isNaN(stanLat) && !isNaN(stanLng)) {
                distance = this.haversineDistance(
                    stanLat, stanLng,
                    this.state.userLocation.lat, this.state.userLocation.lng
                );
                
                // Ambil tarif per KM dari state Supabase (dengan nilai cadangan 3000)
                const ratePerKm = Number(this.state.shipping_rate_per_km) || 3000;
                shipping = Math.ceil(distance) * ratePerKm;

                // Terapkan batasan Minimum & Maximum Fee dari Supabase jika ada
                const minFee = Number(this.state.minimum_fee) || 0;
                const maxFee = Number(this.state.maximum_fee) || 0;

                if (minFee > 0 && shipping < minFee) {
                    shipping = minFee;
                }
                if (maxFee > 0 && shipping > maxFee) {
                    shipping = maxFee;
                }
            }
        }

        let subtotal = 0;
        if (Array.isArray(this.cart) && this.cart.length > 0) {
            subtotal += this.cart.reduce((sum, item) => sum + (Number(item.price || item.harga) * (Number(item.qty) || 1)), 0);
        }

        document.querySelectorAll('.order-item-row').forEach(row => {
            const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
            const qty = parseInt(row.querySelector('.item-qty')?.value) || 1;
            subtotal += (price * qty);
        });

        // Ambil biaya layanan otomatis dari state Supabase (default 1000)
        const serviceFee = Number(this.state.service_fee) || 1000;
        const grandTotal = subtotal + shipping + serviceFee;

        // Perbarui elemen HTML pada halaman
        const distEl = document.getElementById('summaryDistance');
        const shipEl = document.getElementById('summaryShipping');
        const servEl = document.getElementById('summaryService_fee');
        const totalEl = document.getElementById('summaryTotal');

        if (distEl) distEl.innerText = `${distance.toFixed(1)} km`;
        if (shipEl) shipEl.innerText = `Rp ${shipping.toLocaleString('id-ID')}`;
        if (servEl) servEl.innerText = `Rp ${serviceFee.toLocaleString('id-ID')}`;
        if (totalEl) totalEl.innerText = `Rp ${grandTotal.toLocaleString('id-ID')}`;

        this.state.calculatedGrandTotal = grandTotal;
    },

    async processOrder(e) {
        e.preventDefault();
        if (!this.state.userLocation) {
            this.showToast("Harap ambil titik lokasi GPS Anda terlebih dahulu!");
            return;
        }

        // 1. Gabungkan item dari keranjang (cart) dan input manual di form
        let itemsToProcess = [...this.cart];

        document.querySelectorAll('.order-item-row').forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const priceInput = row.querySelector('.item-price');
            const qtyInput = row.querySelector('.item-qty');

            if (nameInput && priceInput && nameInput.value.trim() !== '') {
                itemsToProcess.push({
                    name: nameInput.value.trim(),
                    price: parseFloat(priceInput.value) || 0,
                    qty: parseInt(qtyInput?.value) || 1
                });
            }
        });

        if (itemsToProcess.length === 0) {
            this.showToast("Keranjang pesanan masih kosong!");
            return;
        }

        const name = document.getElementById('orderName').value;
        const wa = document.getElementById('orderWa').value;
        const address = document.getElementById('orderAddress').value;
        const notes = document.getElementById('orderNotes').value;
        const payment = document.getElementById('orderPayment').value;

        let orderListText = itemsToProcess.map((item, i) => 
            `- ${item.name} (${item.qty || 1}x) @Rp${Number(item.price).toLocaleString('id-ID')}`
        ).join('%0A');

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const merchantName = this.state.currentMerchant ? (this.state.currentMerchant.nama || this.state.currentMerchant.name) : 'Stan Jastip';
        
        try {
            await dbClient.from('orders').insert([{
                id: orderId,
                date: new Date().toISOString().split('T')[0],
                customer: name,
                merchant: merchantName,
                total: this.state.calculatedGrandTotal || 0,
                status: 'Menunggu'
            }]);
        } catch(err) {
            console.error("Gagal simpan order ke Supabase:", err);
        }

        const textWa = `*ORDER BARU - JASTIP WEB*%0A%0A` +
            `*ID:* ${orderId}%0A` +
            `*Stan / Merchant:* ${merchantName}%0A` +
            `*Pemesan:* ${name}%0A` +
            `*WA:* ${wa}%0A` +
            `*Alamat:* ${address}%0A` +
            `*Maps Pelanggan:* https://www.google.com/maps?q=${this.state.userLocation.lat},${this.state.userLocation.lng}%0A` +
            `*Jarak & Ongkir:* ${document.getElementById('summaryDistance')?.innerText || '0 km'} (${document.getElementById('summaryShipping')?.innerText || 'Rp 0'})%0A%0A` +
            `*Pesanan:*%0A${orderListText}%0A%0A` +
            `*Catatan:* ${notes || '-'}%0A` +
            `*Pembayaran:* ${payment}%0A` +
            `*Total Tagihan:* ${document.getElementById('summaryTotal')?.innerText || 'Rp 0'}%0A%0A` +
            `_Segera proses pesanan ini._`;

        this.showToast("Pesanan dibuat! Membuka WhatsApp...");
        setTimeout(() => {
            window.open(`https://wa.me/${this.state.admin_whatsapp}?text=${textWa}`, '_blank');
            this.cart = [];
            this.updateCartBadge();
            this.clearAndGoHome();
        }, 1200);
    },

    // --- UTILITIES & SETTINGS ---

    async loadSettings() {
        try {
            const { data, error } = await dbClient.from('settings').select('*').single();
            if (error) throw error;
            
            if (data) {
                this.state.settings = data;
                
                // Pastikan mengambil langsung dari kolom Supabase
                if (data.shipping_rate_per_km !== undefined && data.shipping_rate_per_km !== null) {
                    this.state.shipping_rate_per_km = Number(data.shipping_rate_per_km);
                }
                if (data.service_fee !== undefined && data.service_fee !== null) {
                    this.state.service_fee = Number(data.service_fee);
                }
                if (data.minimum_fee !== undefined && data.minimum_fee !== null) {
                    this.state.minimum_fee = Number(data.minimum_fee);
                }
                if (data.maximum_fee !== undefined && data.maximum_fee !== null) {
                    this.state.maximum_fee = Number(data.maximum_fee);
                }
                
                const waLink = document.getElementById('whatsappLink');
                const adminPhone = data.admin_whatsapp || data.whatsapp || data.phone;
                
                if (adminPhone) {
                    let formattedPhone = adminPhone.trim();
                    if (formattedPhone.startsWith('0')) {
                        formattedPhone = '62' + formattedPhone.substring(1);
                    }
                    this.state.admin_whatsapp = formattedPhone;
                    if (waLink) waLink.href = `https://wa.me/${formattedPhone}`;
                }
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan:", err);
        }
    },

    showToast(message) {
        const toast = document.getElementById('toastMessage');
        if (toast) {
            toast.innerText = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    },

    clearAndGoHome() {
        const searchInput = document.getElementById('liveSearch');
        const clearBtn = document.getElementById('clearSearch');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('d-none');

        const homeView = document.getElementById('homeView');
        const searchView = document.getElementById('searchView');
        const pesananView = document.getElementById('pesananView');
        const detailView = document.getElementById('detailView');
        const memberView = document.getElementById('memberView');

        if (homeView) homeView.style.display = 'block';
        if (searchView) searchView.classList.add('d-none');
        if (pesananView) pesananView.style.display = 'none';
        if (detailView) detailView.classList.add('d-none');
        if (memberView) memberView.style.display = 'none';
        
        const backBtn = document.getElementById('backToHomeBtn');
        if (backBtn) backBtn.classList.add('d-none');

        document.querySelectorAll('.app-bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        const homeNav = document.getElementById('nav-home');
        if (homeNav) homeNav.classList.add('active');
        window.scrollTo(0, 0);
    },

    searchCategory(cat) {
        const searchInput = document.getElementById('liveSearch');
        const clearBtn = document.getElementById('clearSearch');
        if (searchInput) searchInput.value = cat;
        if (clearBtn) clearBtn.classList.remove('d-none');
        this.filterMerchants(cat);
    },

    async loadMerchants() {
        try {
            const { data, error } = await dbClient.from('merchants').select('*');
            if (error) throw error;
            this.state.merchants = data || [];
            this.renderMerchantGrid(this.state.merchants);
        } catch (err) {
            console.error("Gagal memuat merchant:", err);
            const container = document.getElementById('merchantListContainer');
            if (container) container.innerHTML = '<p class="text-center text-muted">Belum ada merchant tersedia di database.</p>';
        }
    },

    renderMerchantGrid(data) {
        const container = document.getElementById('merchantListContainer');
        if (!container) return;
        if (data.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Belum ada merchant.</p>';
            return;
        }

        container.innerHTML = data.map(m => `
            <div class="col-6 col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100 product-card" onclick="app.openMerchantDetail('${m.id}')" style="border-radius: 12px; cursor: pointer;">
                    <img src="${m.foto || m.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'}" class="card-img-top" style="height: 110px; object-fit: cover; border-top-left-radius: 12px; border-top-right-radius: 12px;">
                    <div class="card-body p-2">
                        <h6 class="fw-bold text-dark text-truncate mb-1" style="font-size:0.85rem;">${m.nama || m.name}</h6>
                        <span class="badge bg-light text-primary border" style="font-size:0.65rem;">${m.category || 'Makanan'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    filterMerchants(keyword) {
        const homeView = document.getElementById('homeView');
        const searchView = document.getElementById('searchView');
        const detailView = document.getElementById('detailView');
        const pesananView = document.getElementById('pesananView');
        const memberView = document.getElementById('memberView');

        if (homeView) homeView.style.display = 'none';
        if (searchView) searchView.classList.remove('d-none');
        if (detailView) detailView.classList.add('d-none');
        if (pesananView) pesananView.style.display = 'none';
        if (memberView) memberView.style.display = 'none';

        const filtered = this.state.merchants.filter(m => {
            const name = m.nama || m.name || '';
            const cat = m.category || '';
            return name.toLowerCase().includes(keyword.toLowerCase()) || cat.toLowerCase().includes(keyword.toLowerCase());
        });

        const resultContainer = document.getElementById('resultContainer');
        if (!resultContainer) return;

        if (filtered.length === 0) {
            resultContainer.innerHTML = '<p class="text-center text-muted mt-5">Merchant tidak ditemukan.</p>';
            return;
        }

        resultContainer.innerHTML = '<div class="row g-2">' + filtered.map(m => `
            <div class="col-6 col-md-4 mb-3">
                <div class="card border-0 shadow-sm h-100 product-card" onclick="app.openMerchantDetail('${m.id}')" style="border-radius: 12px; cursor: pointer;">
                    <img src="${m.foto || m.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'}" class="card-img-top" style="height: 110px; object-fit: cover; border-top-left-radius: 12px;">
                    <div class="card-body p-2">
                        <h6 class="fw-bold text-dark text-truncate mb-1" style="font-size:0.85rem;">${m.nama || m.name}</h6>
                        <span class="badge bg-light text-primary border" style="font-size:0.65rem;">${m.category || 'Makanan'}</span>
                    </div>
                </div>
            </div>
        `).join('') + '</div>';
    },

    setupEventListeners() {
        const searchInput = document.getElementById('liveSearch');
        const clearBtn = document.getElementById('clearSearch');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val.length > 0 && clearBtn) clearBtn.classList.remove('d-none');
                else if (clearBtn) clearBtn.classList.add('d-none');
                this.filterMerchants(val);
            });
        }
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearAndGoHome());

        const itemsContainer = document.getElementById('orderItemsContainer');
        if (itemsContainer) {
            itemsContainer.addEventListener('input', () => this.calculateInvoice());
        }
    },

    async loadBanners() {
        try {
            const { data, error } = await dbClient.from('banners').select('*').order('id', { ascending: false });
            if (error) throw error;
            
            const slider = document.getElementById('bannerSlider');
            const dotsContainer = document.getElementById('bannerDots');
            if (!slider) return;

            const banners = data || [];
            if (banners.length === 0) {
                slider.innerHTML = `
                    <div class="banner-card-item">
                        <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600" alt="Default Banner">
                        <div class="banner-overlay">
                            <span class="banner-badge">BUKA TIAP HARI</span>
                            <div class="banner-title">JASTIP TERCEPAT</div>
                            <div class="banner-subtitle">LAYANAN ANTAR MAKANAN PROFESIONAL</div>
                        </div>
                    </div>`;
                return;
            }

            slider.innerHTML = banners.map(b => `
                <div class="banner-card-item">
                    <img src="${b.url}" alt="Promo Banner">
                    <div class="banner-overlay">
                        <span class="banner-badge">PROMO SPESIAL</span>
                        <div class="banner-title">${b.title || 'JASTIP TERCEPAT'}</div>
                        <div class="banner-subtitle">${b.subtitle || 'LAYANAN ANTAR MAKANAN PROFESIONAL'}</div>
                    </div>
                </div>
            `).join('');

            if (dotsContainer) {
                dotsContainer.innerHTML = banners.map((_, i) => `
                    <div class="dot ${i === 0 ? 'active' : ''}" onclick="app.goToSlide(${i})"></div>
                `).join('');
            }
        } catch (err) {
            console.error("Gagal memuat banner:", err);
        }
    },

    goToSlide(idx) {
        const slider = document.getElementById('bannerSlider');
        if (slider) slider.style.transform = `translateX(-${idx * 100}%)`;
        document.querySelectorAll('#bannerDots .dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    },

    // --- AUTHENTICATION & NAVIGATION TABS ---

    switchTab(tabName) {
        const homeView = document.getElementById('homeView');
        const pesananView = document.getElementById('pesananView');
        const memberView = document.getElementById('memberView');
        const searchView = document.getElementById('searchView');
        const detailView = document.getElementById('detailView');

        if (homeView) homeView.style.display = 'none';
        if (pesananView) pesananView.style.display = 'none';
        if (memberView) memberView.style.display = 'none';
        if (searchView) searchView.classList.add('d-none');
        if (detailView) detailView.classList.add('d-none');

        const backBtn = document.getElementById('backToHomeBtn');
        if (backBtn) backBtn.classList.add('d-none');

        if (tabName === 'home' && homeView) homeView.style.display = 'block';
        if (tabName === 'pesanan' && pesananView) {
            pesananView.style.display = 'block';
            this.renderOrderPage();
        }
        if (tabName === 'member' && memberView) {
            memberView.style.display = 'block';
            this.updateMemberUI();
        }

        document.querySelectorAll('.app-bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
        const activeNav = document.getElementById(`nav-${tabName}`);
        if (activeNav) activeNav.classList.add('active');
        window.scrollTo(0, 0);
    },

    switchToGuest() {
        document.getElementById('memberGuestState')?.classList.remove('d-none');
        document.getElementById('memberLoginState')?.classList.add('d-none');
        document.getElementById('memberRegisterState')?.classList.add('d-none');
        document.getElementById('memberForgotPasswordState')?.classList.add('d-none');
        document.getElementById('memberProfileState')?.classList.add('d-none');
    },

    switchToLogin() {
        document.getElementById('memberGuestState')?.classList.add('d-none');
        document.getElementById('memberLoginState')?.classList.remove('d-none');
        document.getElementById('memberRegisterState')?.classList.add('d-none');
        document.getElementById('memberForgotPasswordState')?.classList.add('d-none');
        document.getElementById('memberProfileState')?.classList.add('d-none');
    },

    switchToRegister() {
        document.getElementById('memberGuestState')?.classList.add('d-none');
        document.getElementById('memberLoginState')?.classList.add('d-none');
        document.getElementById('memberRegisterState')?.classList.remove('d-none');
        document.getElementById('memberForgotPasswordState')?.classList.add('d-none');
        document.getElementById('memberProfileState')?.classList.add('d-none');
    },

    switchToForgotPassword() {
        document.getElementById('memberGuestState')?.classList.add('d-none');
        document.getElementById('memberLoginState')?.classList.add('d-none');
        document.getElementById('memberRegisterState')?.classList.add('d-none');
        document.getElementById('memberForgotPasswordState')?.classList.remove('d-none');
        document.getElementById('memberProfileState')?.classList.add('d-none');
    },

    updateMemberUI() {
        const session = JSON.parse(localStorage.getItem('jastipUser'));
        if (session) {
            document.getElementById('memberGuestState')?.classList.add('d-none');
            document.getElementById('memberLoginState')?.classList.add('d-none');
            document.getElementById('memberRegisterState')?.classList.add('d-none');
            document.getElementById('memberForgotPasswordState')?.classList.add('d-none');
            document.getElementById('memberProfileState')?.classList.remove('d-none');

            const nameDisp = document.getElementById('profileNameDisplay');
            const roleDisp = document.getElementById('profileRoleDisplay');
            if (nameDisp) nameDisp.innerText = session.username || session.name || 'Member';
            if (roleDisp) roleDisp.innerText = session.role ? session.role.toUpperCase() : 'MEMBER';
        } else {
            this.switchToGuest();
        }
    },

    checkAuthSession() {
        const session = JSON.parse(localStorage.getItem('jastipUser'));
        if (session && session.role && session.role.toLowerCase() === 'admin') {
            window.location.href = 'admin.html';
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('loginEmail').value.trim();
        const passwordInput = document.getElementById('loginPassword').value.trim();

        try {
            const { data, error } = await dbClient
                .from('profiles')
                .select('*')
                .eq('username', usernameInput)
                .eq('password', passwordInput)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                if (data.role && data.role.toLowerCase() === 'admin') {
                    localStorage.setItem('jastipUser', JSON.stringify(data));
                    this.showToast('Mengalihkan ke Panel Admin...');
                    setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
                    return;
                }

                localStorage.setItem('jastipUser', JSON.stringify(data));
                this.showToast('Login member berhasil!');
                this.updateMemberUI();
            } else {
                this.showToast('Username atau Password salah!');
            }
        } catch (err) {
            console.error('Login error:', err);
            this.showToast('Gagal login. Periksa koneksi.');
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('regUsername').value.trim();
        const passwordInput = document.getElementById('regPassword').value.trim();

        try {
            const { data: existing } = await dbClient
                .from('profiles')
                .select('*')
                .eq('username', usernameInput)
                .maybeSingle();

            if (existing) {
                this.showToast('Username sudah digunakan!');
                return;
            }

            const { error } = await dbClient
                .from('profiles')
                .insert([{ username: usernameInput, password: passwordInput, role: 'member' }]);

            if (error) throw error;

            this.showToast('Pendaftaran berhasil! Silakan login.');
            this.switchToLogin();
        } catch (err) {
            console.error('Register error:', err);
            this.showToast('Gagal mendaftar: ' + err.message);
        }
    },

    async handleForgotPassword(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('forgotUsername').value.trim();
        const newPasswordInput = document.getElementById('forgotNewPassword').value.trim();

        try {
            const { data: existing, error: checkError } = await dbClient
                .from('profiles')
                .select('*')
                .eq('username', usernameInput)
                .maybeSingle();

            if (checkError) throw checkError;
            if (!existing) {
                this.showToast('Username tidak ditemukan!');
                return;
            }

            const { error: updateError } = await dbClient
                .from('profiles')
                .update({ password: newPasswordInput })
                .eq('username', usernameInput);

            if (updateError) throw updateError;

            this.showToast('Password berhasil direset! Silakan login.');
            this.switchToLogin();
        } catch (err) {
            console.error('Reset password error:', err);
            this.showToast('Gagal mereset password: ' + err.message);
        }
    },

    logout() {
        localStorage.removeItem('jastipUser');
        this.showToast('Berhasil logout.');
        this.switchToGuest();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());