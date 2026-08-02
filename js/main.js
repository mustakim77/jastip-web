/**
 * JASTIP SAWOO - MAIN JS (Full Order, Merchant Menus & GPS Distance Calculation)
 */

const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
    state: {
        merchants: [],
        currentMerchant: null,
        userLocation: null,
        shipping_rate_per_km: null,
        service_fee: 1000,
        admin_whatsapp: "6285799860406",
        calculatedGrandTotal: 0,
        currentSlide: 0,   // <--- Tambahkan ini
        slideTimer: null   // <--- Tambahkan ini
    },
    
    cart: [],

    async init() {
        await this.loadSettings();
        this.loadMerchants();
        await this.loadBanners();
        this.setupEventListeners();
        this.checkAuthSession();
        this.updateMemberUI();
        this.updatePesananBadge();
    },

    // --- 1. MANAJEMEN PESANAN LANGSUNG DARI FORM ---

    saveOrderFromForm() {
        const namaPelanggan = document.getElementById('orderName')?.value.trim() || '';
        const noWa = document.getElementById('orderWa')?.value.trim() || '';
        const alamat = document.getElementById('orderAddress')?.value.trim() || '';
        const catatan = document.getElementById('orderNotes')?.value.trim() || '';
        const metodePembayaran = document.getElementById('orderPayment')?.value || 'COD';

        if (!namaPelanggan || !noWa || !alamat) {
            this.showToast('⚠️ Isi Nama, No WhatsApp, dan Alamat pengiriman!');
            return;
        }

        // --- TAMBAHKAN VALIDASI GPS INI KEMBALI ---
        if (!this.state.userLocation) {
            this.showToast('⚠️ Ambil Titik Lokasi GPS Anda dulu!');
            return;
        }
        // ------------------------------------------

        const inputNamaMenus = document.querySelectorAll('.item-name');
        const inputJumlahs = document.querySelectorAll('.item-qty');
        const inputHargas = document.querySelectorAll('.item-price');

        let items = [];
        let isValid = true;

        for (let i = 0; i < inputNamaMenus.length; i++) {
            let menu = inputNamaMenus[i].value.trim();
            let jumlah = inputJumlahs[i] ? inputJumlahs[i].value : '1';
            let harga = inputHargas[i] ? inputHargas[i].value.trim() : '';

            if (!menu) {
                this.showToast('⚠️ Nama Menu pada baris ke-' + (i + 1) + ' wajib diisi!');
                inputNamaMenus[i].focus();
                isValid = false;
                break;
            }

            if (!jumlah || jumlah <= 0) {
                this.showToast('⚠️ Jumlah pesanan pada baris ke-' + (i + 1) + ' wajib diisi!');
                inputJumlahs[i].focus();
                isValid = false;
                break;
            }

            if (harga === '' || isNaN(harga)) {
                harga = '0';
            }

            items.push({
                menu: menu,
                jumlah: Number(jumlah),
                harga: Number(harga)
            });
        }

        if (!isValid) return;

        const customStanInput = document.getElementById('customStanNameInput');
        const merchantName = customStanInput && customStanInput.value.trim() !== '' 
            ? customStanInput.value.trim() 
            : (this.state.currentMerchant ? (this.state.currentMerchant.nama || this.state.currentMerchant.name) : 'Stan Jastip');

        const merchantLat = this.state.currentMerchant ? (this.state.currentMerchant.latitude || this.state.currentMerchant.lat) : null;
        const merchantLng = this.state.currentMerchant ? (this.state.currentMerchant.longitude || this.state.currentMerchant.lng) : null;

        const pesananBaru = {
            namaPelanggan,
            noWa,
            alamat,
            merchantName,
            merchantLat,
            merchantLng,
            items,
            catatan,
            metodePembayaran,
            userLocation: this.state.userLocation,
            tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        };

        let daftarPesanan = JSON.parse(localStorage.getItem('jastipPesanan')) || [];
        daftarPesanan.push(pesananBaru);
        localStorage.setItem('jastipPesanan', JSON.stringify(daftarPesanan));

        this.updatePesananBadge();
        this.renderPesananPage();

        this.showToast('✅ Berhasil dimasukkan Daftar Pesanan!');
        this.switchTab('pesanan');
    },

    updatePesananBadge() {
        let daftarPesanan = JSON.parse(localStorage.getItem('jastipPesanan')) || [];
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.innerText = daftarPesanan.length;
            badge.style.display = daftarPesanan.length > 0 ? 'inline-block' : 'none';
        }
    },

    // Render tampilan di halaman Pesanan
    renderPesananPage() {
        const container = document.getElementById('orderHistoryContainer');
        if (!container) return;

        let daftarPesanan = JSON.parse(localStorage.getItem('jastipPesanan')) || [];

        if (daftarPesanan.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fa-solid fa-receipt text-muted fs-1 mb-2 opacity-50"></i>
                    <p class="text-muted small mb-0">Belum ada pesanan.</p>
                </div>`;
            return;
        }

        container.innerHTML = daftarPesanan.map((pesan, index) => {
            let totalHarga = pesan.items.reduce((sum, item) => sum + (item.jumlah * item.harga), 0);
            return `
                <div class="card mb-3 p-3 shadow-sm border-0 bg-light rounded-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold text-primary mb-1">Pesanan #${index + 1} (${pesan.merchantName || 'Stan'})</h6>
                            <p class="mb-1 small"><strong>Pemesan:</strong> ${pesan.namaPelanggan || 'Tanpa Nama'} (${pesan.noWa || '-'})</p>
                            <p class="mb-1 small"><strong>Alamat:</strong> ${pesan.alamat || '-'}</p>
                            <p class="mb-2 small text-muted"><strong>Bayar:</strong> ${pesan.metodePembayaran || '-'}</p>
                        </div>
                        <button type="button" class="btn btn-sm text-danger p-0" onclick="app.hapusPesanan(${index})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <hr class="my-2">
                    <ul class="list-unstyled mb-0">
                        ${pesan.items.map(item => `
                            <li class="d-flex justify-content-between small py-1 border-bottom">
                                <span>${item.jumlah}x ${item.menu}</span>
                                <span class="fw-semibold">Rp ${(item.jumlah * item.harga).toLocaleString('id-ID')}</span>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="d-flex justify-content-between align-items-center mt-2 pt-1">
                        <span class="small text-muted">${pesan.tanggal || ''}</span>
                        <span class="fw-bold text-dark small">Total Menu: Rp ${totalHarga.toLocaleString('id-ID')}</span>
                    </div>
                    ${pesan.catatan ? `<div class="mt-2 small text-muted bg-white p-2 rounded">Catatan: ${pesan.catatan}</div>` : ''}
                </div>
            `;
        }).join('') + `
            <div class="d-grid gap-2 mt-3">
                <button type="button" class="btn btn-success rounded-pill fw-bold py-2 shadow-sm" onclick="app.kirimSemuaPesananWA()">
                    <i class="fa-brands fa-whatsapp me-2"></i>Kirim Semua Pesanan via WhatsApp
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" onclick="app.kosongkanPesanan()">Hapus Semua Daftar Pesanan</button>
            </div>
        `;
    },

    // Fungsi untuk mengirim seluruh list pesanan ke WhatsApp dengan logika jarak stan terjauh
    kirimSemuaPesananWA() {
        let daftarPesanan = JSON.parse(localStorage.getItem('jastipPesanan')) || [];
        if (daftarPesanan.length === 0) {
            this.showToast('Tidak ada pesanan untuk dikirim');
            return;
        }

        let pesan = "*LIST PESANAN JASTIP SAWOO*\n\n";
        let totalSubtotalMenu = 0;
        let maxDistance = 0;
        let infoLokasi = 'Belum diambil';
        let userLoc = null;

        daftarPesanan.forEach((pesanItem, index) => {
            pesan += `*Pesanan #${index + 1} - Stan: ${pesanItem.merchantName || 'Stan'}*\n`;
            pesan += `Pemesan: ${pesanItem.namaPelanggan}\n`;
            pesan += `No WA: ${pesanItem.noWa}\n`;
            pesan += `Alamat: ${pesanItem.alamat}\n`;
            pesan += `Pembayaran: ${pesanItem.metodePembayaran}\n`;
            pesan += `*Menu:*\n`;
            
            let subMenu = 0;
            pesanItem.items.forEach(item => {
                let sub = item.jumlah * item.harga;
                subMenu += sub;
                pesan += `- ${item.jumlah}x ${item.menu} @Rp${Number(item.harga).toLocaleString('id-ID')} (Rp ${sub.toLocaleString('id-ID')})\n`;
            });
            
            pesan += `Subtotal Menu: Rp ${subMenu.toLocaleString('id-ID')}\n`;
            
            if (pesanItem.catatan) {
                pesan += `Catatan: ${pesanItem.catatan}\n`;
            }

            totalSubtotalMenu += subMenu;

            // Ambil lokasi pelanggan
            if (pesanItem.userLocation) {
                userLoc = pesanItem.userLocation;
                infoLokasi = `https://maps.google.com/?q=${userLoc.lat},${userLoc.lng}`;
            }

            // Hitung jarak stan ini ke pelanggan, cari yang PALING JAUH
            if (pesanItem.merchantLat && pesanItem.merchantLng && pesanItem.userLocation) {
                let dist = this.haversineDistance(
                    Number(pesanItem.merchantLat), Number(pesanItem.merchantLng),
                    Number(pesanItem.userLocation.lat), Number(pesanItem.userLocation.lng)
                );
                if (dist > maxDistance) {
                    maxDistance = dist;
                }
            }

            pesan += `\n-------------------\n\n`;
        });

        // Hitung ongkir berdasarkan Jarak Terjauh
        const ratePerKm = Number(this.state.shipping_rate_per_km) || 3000;
        let calculatedShipping = maxDistance > 0 ? Math.ceil(maxDistance) * ratePerKm : 0;

        // Terapkan batas Min/Max Fee jika ada
        const minFee = Number(this.state.minimum_fee) || 0;
        const maxFee = Number(this.state.maximum_fee) || 0;
        if (minFee > 0 && calculatedShipping < minFee) calculatedShipping = minFee;
        if (maxFee > 0 && calculatedShipping > maxFee) calculatedShipping = maxFee;

        // Biaya layanan dihitung 1 kali
        const serviceFee = Number(this.state.service_fee) || 1000;
        
        // Total keseluruhan = Total Menu + 1x Ongkir Terjauh + 1x Biaya Layanan
        const grandTotalAll = totalSubtotalMenu + calculatedShipping + serviceFee;

        // Ringkasan Akhir Pesanan
        pesan += `Jarak Terjauh Stan: ${maxDistance.toFixed(1)} km\n`;
        pesan += `Ongkir Bersama: Rp ${calculatedShipping.toLocaleString('id-ID')}\n`;
        pesan += `Biaya Layanan: Rp ${serviceFee.toLocaleString('id-ID')}\n`;
        pesan += `Maps Pelanggan: ${infoLokasi}\n`;
        pesan += `*Total Tagihan:* Rp ${grandTotalAll.toLocaleString('id-ID')}\n\n`;
        pesan += `_Segera proses pesanan ini._`;

        let urlWA = `https://wa.me/${this.state.admin_whatsapp}?text=${encodeURIComponent(pesan)}`;
        window.open(urlWA, '_blank');
    },

    hapusPesanan(index) {
        let daftarPesanan = JSON.parse(localStorage.getItem('jastipPesanan')) || [];
        daftarPesanan.splice(index, 1);
        localStorage.setItem('jastipPesanan', JSON.stringify(daftarPesanan));
        this.renderPesananPage();
        this.updatePesananBadge();
        this.showToast('Pesanan dihapus');
    },

    kosongkanPesanan() {
        if (confirm('Yakin ingin menghapus semua daftar pesanan?')) {
            localStorage.removeItem('jastipPesanan');
            this.renderPesananPage();
            this.updatePesananBadge();
            this.showToast('Semua pesanan dikosongkan');
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

            const imgEl = document.getElementById('detailMerchantImg');
            const nameEl = document.getElementById('detailMerchantName');
            const descEl = document.getElementById('detailMerchantDesc');
            const hoursEl = document.getElementById('detailMerchantHours');

            if (imgEl) imgEl.src = merchant.foto || merchant.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600';
            if (nameEl) nameEl.innerText = merchant.nama || merchant.name || 'Stan Jastip';
            if (descEl) descEl.innerText = merchant.alamat || merchant.desc || 'Stan terpercaya pilihan Jastip Sawoo.';
            if (hoursEl) hoursEl.innerText = `Buka: ${merchant.jam_buka || merchant.hours || '08:00 - 21:00'}`;

            await this.loadMerchantMenus(id);

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

            if (error || !products || products.length === 0) {
                this.renderManualMenuInput(menuContainer);
                return;
            }

            menuContainer.innerHTML = products.map((prod) => `
                <div class="row g-2 mb-2 order-item-row align-items-center">
                    <div class="col-5"><input type="text" class="form-control item-name" value="${prod.name || prod.nama}" required></div>
                    <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" oninput="app.calculateInvoice()" required></div>
                    <div class="col-4"><input type="number" class="form-control item-price" value="${prod.price || prod.harga || 0}" oninput="app.calculateInvoice()" ></div>
                    <div class="col-1 text-center">
                        <button type="button" class="btn btn-sm text-danger p-0 shadow-none" onclick="app.removeOrderItemRow(this)"><i class="fa-solid fa-trash"></i></button>
                    </div>
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
        row.className = 'row g-2 mb-2 order-item-row align-items-center';
        row.innerHTML = `
            <div class="col-5"><input type="text" class="form-control item-name" placeholder="Nama Menu" required></div>
            <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" oninput="app.calculateInvoice()" required></div>
            <div class="col-4"><input type="number" class="form-control item-price" placeholder="Harga" oninput="app.calculateInvoice()" ></div>
            <div class="col-1 text-center">
                <button type="button" class="btn btn-sm text-danger p-0 shadow-none" onclick="app.removeOrderItemRow(this)">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    },

    removeOrderItemRow(button) {
        const row = button.closest('.order-item-row');
        if (row) {
            row.remove();
            this.calculateInvoice();
            this.showToast('Item menu dihapus');
        }
    },

    renderManualMenuInput(container) {
        container.innerHTML = `
            <div class="row g-2 mb-2 order-item-row align-items-center">
                <div class="col-5"><input type="text" class="form-control item-name" placeholder="Nama Menu" required></div>
                <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" oninput="app.calculateInvoice()" required></div>
                <div class="col-4"><input type="number" class="form-control item-price" placeholder="Harga" oninput="app.calculateInvoice()" ></div>
                <div class="col-1 text-center">
                    <button type="button" class="btn btn-sm text-danger p-0 shadow-none" onclick="app.removeOrderItemRow(this)">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
    },

    // --- 3. GPS & CHECKOUT WA ---
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
        const R = 6371;
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
                const ratePerKm = Number(this.state.shipping_rate_per_km) || 3000;
                shipping = Math.ceil(distance) * ratePerKm;

                const minFee = Number(this.state.minimum_fee) || 0;
                const maxFee = Number(this.state.maximum_fee) || 0;

                if (minFee > 0 && shipping < minFee) shipping = minFee;
                if (maxFee > 0 && shipping > maxFee) shipping = maxFee;
            }
        }

        let subtotal = 0;
        document.querySelectorAll('.order-item-row').forEach(row => {
            const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
            const qty = parseInt(row.querySelector('.item-qty')?.value) || 1;
            subtotal += (price * qty);
        });

        const serviceFee = Number(this.state.service_fee) || 1000;
        const grandTotal = subtotal + shipping + serviceFee;

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
            this.showToast("⚠️ Ambil Titik Lokasi GPS Anda dulu!");
            return;
        }

        let itemsToProcess = [];
        document.querySelectorAll('.order-item-row').forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const priceInput = row.querySelector('.item-price');
            const qtyInput = row.querySelector('.item-qty');

            if (nameInput && nameInput.value.trim() !== '') {
                itemsToProcess.push({
                    name: nameInput.value.trim(),
                    price: parseFloat(priceInput.value) || 0,
                    qty: parseInt(qtyInput?.value) || 1
                });
            }
        });

        if (itemsToProcess.length === 0) {
            this.showToast("Daftar menu pesanan masih kosong!");
            return;
        }

        const name = document.getElementById('orderName').value.trim();
        const wa = document.getElementById('orderWa').value.trim();
        const address = document.getElementById('orderAddress').value.trim();
        const notes = document.getElementById('orderNotes').value.trim();
        const payment = document.getElementById('orderPayment').value;

        const customStanInput = document.getElementById('customStanNameInput');
        const merchantName = customStanInput && customStanInput.value.trim() !== '' 
            ? customStanInput.value.trim() 
            : (this.state.currentMerchant ? (this.state.currentMerchant.nama || this.state.currentMerchant.name) : 'Stan Jastip');

        // Hitung subtotal menu
        let subtotalMenu = 0;
        let orderListText = itemsToProcess.map((item) => {
            let sub = (item.qty || 1) * item.price;
            subtotalMenu += sub;
            return `- ${item.name} (${item.qty || 1}x) @Rp${Number(item.price).toLocaleString('id-ID')} (Rp ${sub.toLocaleString('id-ID')})`;
        }).join('\n');

        // Hitung jarak & ongkir dari stan aktif ke pelanggan (Mendukung lat/latitude & lng/longitude)
        let distance = 0;
        let shipping = 0;
        if (this.state.userLocation && this.state.currentMerchant) {
            const stanLat = Number(this.state.currentMerchant.latitude || this.state.currentMerchant.lat);
            const stanLng = Number(this.state.currentMerchant.longitude || this.state.currentMerchant.lng);

            if (!isNaN(stanLat) && !isNaN(stanLng) && stanLat !== 0 && stanLng !== 0) {
                distance = this.haversineDistance(stanLat, stanLng, this.state.userLocation.lat, this.state.userLocation.lng);
                const ratePerKm = Number(this.state.shipping_rate_per_km) || 3000;
                shipping = Math.ceil(distance) * ratePerKm;

                const minFee = Number(this.state.minimum_fee) || 0;
                const maxFee = Number(this.state.maximum_fee) || 0;
                if (minFee > 0 && shipping < minFee) shipping = minFee;
                if (maxFee > 0 && shipping > maxFee) shipping = maxFee;
            }
        }

        const serviceFee = Number(this.state.service_fee) || 1000;
        const grandTotal = subtotalMenu + shipping + serviceFee;
        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        try {
            await dbClient.from('orders').insert([{
                id: orderId,
                date: new Date().toISOString().split('T')[0],
                customer: name,
                merchant: merchantName,
                total: grandTotal,
                status: 'Menunggu'
            }]);
        } catch(err) {
            console.error("Gagal simpan order ke Supabase:", err);
        }

        // Susun teks pesan WhatsApp yang lengkap dan rapi
        let pesan = `*ORDER BARU - JASTIP SAWOO*\n\n`;
        pesan += `*ID:* ${orderId}\n`;
        pesan += `*Stan / Merchant:* ${merchantName}\n`;
        pesan += `*Pemesan:* ${name}\n`;
        pesan += `*No WA:* ${wa}\n`;
        pesan += `*Alamat:* ${address}\n\n`;
        pesan += `*Menu:*\n${orderListText}\n`;
        pesan += `Subtotal Menu: Rp ${subtotalMenu.toLocaleString('id-ID')}\n\n`;
        if (notes) {
            pesan += `Catatan: ${notes}\n`;
        }
        pesan += `Pembayaran: ${payment}\n`;
        pesan += `Jarak Pengiriman: ${distance.toFixed(1)} km\n`;
        pesan += `Ongkir: Rp ${shipping.toLocaleString('id-ID')}\n`;
        pesan += `Biaya Layanan: Rp ${serviceFee.toLocaleString('id-ID')}\n`;
        pesan += `Maps Pelanggan: https://maps.google.com/?q=${this.state.userLocation.lat},${this.state.userLocation.lng}\n`;
        pesan += `*Total Tagihan:* Rp ${grandTotal.toLocaleString('id-ID')}\n\n`;
        pesan += `_Segera proses pesanan ini._`;

        this.showToast("Pesanan dibuat! Membuka WhatsApp...");
        setTimeout(() => {
            window.open(`https://wa.me/${this.state.admin_whatsapp}?text=${encodeURIComponent(pesan)}`, '_blank');
            this.clearAndGoHome();
        }, 1200);
    },

    openCustomMerchant() {
        this.state.currentMerchant = {
            id: 'custom',
            nama: 'Stan Lainnya (Manual)',
            alamat: 'Stan di luar daftar aplikasi'
        };

        const merchantNameEl = document.getElementById('detailMerchantName');
        const merchantDescEl = document.getElementById('detailMerchantDesc');
        const merchantHoursEl = document.getElementById('detailMerchantHours');
        const merchantImgEl = document.getElementById('detailMerchantImg');

        if (merchantNameEl) merchantNameEl.innerText = 'Stan Lainnya (Manual)';
        if (merchantDescEl) merchantDescEl.innerText = 'Masukkan nama stan dan menu pesanan Anda secara manual di bawah.';
        if (merchantHoursEl) merchantHoursEl.innerText = 'Buka: Sesuai Permintaan';
        if (merchantImgEl) merchantImgEl.src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600';

        const menuContainer = document.getElementById('orderItemsContainer');
        if (menuContainer) {
            menuContainer.innerHTML = `
                <div class="mb-3">
                    <label class="form-label small fw-bold text-dark"><i class="fa-solid fa-store text-primary me-1"></i> Nama Stan / Toko Tujuan</label>
                    <input type="text" id="customStanNameInput" class="form-control" placeholder="Contoh: Es Teh Solo / Mie Ayam Pak Joko" required>
                </div>
                <label class="form-label small fw-bold text-dark mb-2">Daftar Menu Pesanan</label>
                <div class="row g-2 mb-2 order-item-row align-items-center">
                    <div class="col-5"><input type="text" class="form-control item-name" placeholder="Nama Menu" required></div>
                    <div class="col-2"><input type="number" class="form-control item-qty" value="1" min="1" oninput="app.calculateInvoice()" required></div>
                    <div class="col-4"><input type="number" class="form-control item-price" placeholder="Harga" oninput="app.calculateInvoice()" ></div>
                    <div class="col-1 text-center">
                        <button type="button" class="btn btn-sm text-danger p-0 shadow-none" onclick="app.removeOrderItemRow(this)"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        }

        document.getElementById('homeView').style.display = 'none';
        document.getElementById('searchView').classList.add('d-none');
        document.getElementById('pesananView').style.display = 'none';
        document.getElementById('memberView').style.display = 'none';
        document.getElementById('detailView').classList.remove('d-none');

        const backBtn = document.getElementById('backToHomeBtn');
        if (backBtn) backBtn.classList.remove('d-none');

        window.scrollTo(0, 0);
        this.calculateInvoice();
    },

    // --- UTILITIES & SETTINGS ---
    async loadSettings() {
        try {
            const { data, error } = await dbClient.from('settings').select('*').single();
            if (error) throw error;
            if (data) {
                this.state.settings = data;
                if (data.shipping_rate_per_km != null) this.state.shipping_rate_per_km = Number(data.shipping_rate_per_km);
                if (data.service_fee != null) this.state.service_fee = Number(data.service_fee);
                if (data.minimum_fee != null) this.state.minimum_fee = Number(data.minimum_fee);
                if (data.maximum_fee != null) this.state.maximum_fee = Number(data.maximum_fee);
                
                const waLink = document.getElementById('whatsappLink');
                const adminPhone = data.admin_whatsapp || data.whatsapp || data.phone;
                if (adminPhone) {
                    let formattedPhone = adminPhone.trim();
                    if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.substring(1);
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
            // Tentukan ikon berdasarkan isi pesan agar terasa interaktif
            let icon = '<i class="fa-solid fa-circle-check text-success"></i>';
            if (message.includes('⚠️') || message.includes('kosong') || message.includes('Salah')) {
                icon = '<i class="fa-solid fa-circle-exclamation text-danger"></i>';
            }

            toast.innerHTML = `${icon} <span>${message.replace(/^[✅⚠️❌]\s*/, '')}</span>`;
            toast.classList.add('show');
            
            // Hapus timeout sebelumnya jika ada agar tidak tumpang tindih
            if (toast.timeoutId) clearTimeout(toast.timeoutId);
            
            toast.timeoutId = setTimeout(() => {
                toast.classList.remove('show');
            }, 2800);
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
            if (container) container.innerHTML = '<p class="text-center text-muted">Belum ada merchant tersedia.</p>';
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
                    <img src="${m.foto || m.img || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400'}" class="card-img-top" style="height: 110px; object-fit:contain; border-top-left-radius: 12px; border-top-right-radius: 12px;">
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
            itemsContainer.addEventListener('input', (e) => {
                if (e.target.classList.contains('item-price') || e.target.classList.contains('item-qty')) {
                    this.calculateInvoice();
                }
            });
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
                            <span class="banner-badge">OPEN SETIAP HARI</span>
                            <div class="banner-title">JASTIP SAWOO</div>
                            <div class="banner-subtitle">Area SAWOO, SAMBIT Dan Sekitarnya</div>
                        </div>
                    </div>`;
                return;
            }

            slider.innerHTML = banners.map(b => `
    <div class="banner-card-item">
        <img src="${b.url}" alt="Promo Banner">
        <div class="banner-overlay">
            ${b.title ? `<div class="banner-title">${b.title}</div>` : ''}
            ${b.subtitle ? `<div class="banner-subtitle">${b.subtitle}</div>` : ''}
        </div>
    </div>
`).join('');

            if (dotsContainer) {
                dotsContainer.innerHTML = banners.map((_, i) => `
                    <div class="dot ${i === 0 ? 'active' : ''}" onclick="app.goToSlide(${i})"></div>
                `).join('');
            }

            // --- MULAI AUTO SLIDE OTOMATIS ---
            this.startAutoSlide(banners.length);

        } catch (err) {
            console.error("Gagal memuat banner:", err);
        }
    },

    startAutoSlide(totalSlides) {
        if (this.state.slideTimer) clearInterval(this.state.slideTimer);
        
        this.state.slideTimer = setInterval(() => {
            this.state.currentSlide = (this.state.currentSlide + 1) % totalSlides;
            this.goToSlide(this.state.currentSlide);
        }, 3500); // Banner akan bergeser otomatis setiap 3.5 detik
    },

    goToSlide(idx) {
        this.state.currentSlide = idx;
        const slider = document.getElementById('bannerSlider');
        if (slider) slider.style.transform = `translateX(-${idx * 100}%)`;
        document.querySelectorAll('#bannerDots .dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    },

    // --- NAVIGATION & AUTH ---
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
            this.renderPesananPage();
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
                    this.showToast('Login Panel Admin');
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