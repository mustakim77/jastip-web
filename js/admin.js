/**
 * JASTIP WEB - ADMIN JS (Optional Photo Upload, Edit & Maps)
 */

const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adminApp = {
    state: {
        merchants: [],
        orders: [],
        banners: [],
        settings: {}
    },

    async init() {
        this.setupSidebarToggle();
        await this.fetchAllData();
        this.setupEventListeners();
        this.initLeafletMap();
    },

    logout() {
        localStorage.removeItem('jastipUser');
        window.location.href = 'index.html';
    },

    setupSidebarToggle() {
        const toggleBtn = document.getElementById('menu-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                document.getElementById('wrapper').classList.toggle('toggled');
            });
        }
    },

    switchSection(targetId, el) {
        document.querySelectorAll('.list-group-item').forEach(i => i.classList.remove('active'));
        if (el) el.classList.add('active');

        document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
        const target = document.getElementById(`section-${targetId}`);
        if (target) target.style.display = 'block';

        const titles = {
            'dashboard': 'Dashboard Overview',
            'merchant': 'Kelola Stan / Merchant',
            'pesanan': 'Pesanan Masuk',
            'banner': 'Banner Promosi',
            'pengaturan': 'Pengaturan Tarif & Sistem'
        };
        document.getElementById('pageTitle').innerText = titles[targetId] || 'Admin Panel';

        if (window.innerWidth <= 768) {
            document.getElementById('wrapper').classList.remove('toggled');
        }
    },

    // Hapus 1 pesanan berdasarkan ID dengan password khusus (Input teks biasa)
    async deleteAdminOrder(orderId) {
        const { value: passwordInput, isConfirmed } = await Swal.fire({
            title: 'Konfirmasi Penghapusan',
            text: 'Masukkan password khusus untuk menghapus pesanan ini:',
            input: 'text',
            inputPlaceholder: 'Ketik password di sini...',
            showCancelButton: true,
            confirmButtonText: 'Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#FF3B30',
            cancelButtonColor: '#8E8E93',
            customClass: {
                popup: 'rounded-4 shadow-lg border-0'
            }
        });

        if (!isConfirmed) return;

        const SPECIAL_PASSWORD = "koirul07";

        if (passwordInput !== SPECIAL_PASSWORD) {
            Swal.fire({
                icon: 'error',
                title: 'Akses Ditolak',
                text: 'Password khusus salah! Penghapusan dibatalkan.',
                confirmButtonColor: '#007AFF',
                customClass: { popup: 'rounded-4' }
            });
            return;
        }

        try {
            const { error } = await dbClient
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'Terhapus!',
                text: 'Pesanan berhasil dihapus dari database.',
                timer: 1800,
                showConfirmButton: false,
                customClass: { popup: 'rounded-4' }
            });
            
            this.fetchAllData();
        } catch (err) {
            console.error("Gagal menghapus pesanan:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal menghapus pesanan dari server.',
                confirmButtonColor: '#007AFF',
                customClass: { popup: 'rounded-4' }
            });
        }
    },

    // Hapus SEMUA pesanan dengan password khusus
    async deleteAllAdminOrders() {
        const { value: passwordInput, isConfirmed } = await Swal.fire({
            title: '⚠️ Peringatan Ekstrem',
            text: 'Masukkan password khusus untuk menghapus SEMUA pesanan:',
            input: 'text',
            inputPlaceholder: 'Ketik password di sini...',
            showCancelButton: true,
            confirmButtonText: 'Hapus Semua',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#FF3B30',
            cancelButtonColor: '#8E8E93',
            customClass: {
                popup: 'rounded-4 shadow-lg border-0'
            }
        });

        if (!isConfirmed) return;

        const SPECIAL_PASSWORD = "koirul07";

        if (passwordInput !== SPECIAL_PASSWORD) {
            Swal.fire({
                icon: 'error',
                title: 'Akses Ditolak',
                text: 'Password khusus salah! Penghapusan massal dibatalkan.',
                confirmButtonColor: '#007AFF',
                customClass: { popup: 'rounded-4' }
            });
            return;
        }

        try {
            // 1. Ambil semua ID pesanan di database
            const { data: allOrders, error: fetchError } = await dbClient.from('orders').select('id');
            if (fetchError) throw fetchError;

            if (!allOrders || allOrders.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Kosong',
                    text: 'Tidak ada pesanan yang tersisa.',
                    confirmButtonColor: '#007AFF',
                    customClass: { popup: 'rounded-4' }
                });
                return;
            }

            // 2. Petakan ID ke dalam array
            const idsToDelete = allOrders.map(o => o.id);

            // 3. Hapus data berdasarkan array ID tersebut
            const { error } = await dbClient
                .from('orders')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: 'Berhasil Dikosongkan!',
                text: 'Semua daftar pesanan berhasil dikosongkan.',
                timer: 1800,
                showConfirmButton: false,
                customClass: { popup: 'rounded-4' }
            });
            
            this.fetchAllData();
        } catch (err) {
            console.error("Gagal mengosongkan pesanan:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal mengosongkan data pesanan: ' + err.message,
                confirmButtonColor: '#007AFF',
                customClass: { popup: 'rounded-4' }
            });
        }
    },

    async fetchAllData() {
        Swal.fire({ title: 'Memuat data...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
        try {
            const [mRes, oRes, bRes, sRes] = await Promise.all([
                dbClient.from('merchants').select('*').order('id', { ascending: false }),
                dbClient.from('orders').select('*').order('date', { ascending: false }),
                dbClient.from('banners').select('*').order('id', { ascending: false }),
                dbClient.from('settings').select('*').eq('id', 1).maybeSingle()
            ]);

            this.state.merchants = mRes.data || [];
            this.state.orders = oRes.data || [];
            this.state.banners = bRes.data || [];
            if (sRes.data) {
                this.state.settings = sRes.data;
                this.renderSettingsValues(sRes.data);
            }

            this.renderDashboard();
            this.renderMerchants();
            this.renderOrders();
            this.renderBanners();

            Swal.close();
        } catch (err) {
            Swal.fire('Error', 'Gagal memuat data dari database: ' + err.message, 'error');
        }
    },

    renderDashboard() {
        document.getElementById('stat-orders').innerText = this.state.orders.length;
        document.getElementById('stat-merchants').innerText = this.state.merchants.length;
        
        const feePerOrder = Number(this.state.settings.service_fee || '');
        const totalRevenue = this.state.orders.length * feePerOrder;
        document.getElementById('stat-revenue').innerText = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    },

    renderSettingsValues(settings) {
        const wa = document.getElementById('setWa');
        const min = document.getElementById('setMin');
        const max = document.getElementById('setMax');
        const service = document.getElementById('setService');
        const shippingRate = document.getElementById('setShippingRate');

        if (wa) wa.value = settings.admin_whatsapp || '';
        if (min) min.value = settings.minimum_fee || '';
        if (max) max.value = settings.maximum_fee || '';
        if (service) service.value = settings.service_fee || '';
        if (shippingRate) shippingRate.value = settings.shipping_rate_per_km || '';
    },

    renderMerchants() {
        const tbody = document.getElementById('tableMerchants');
        if (!tbody) return;
        if (this.state.merchants.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Belum ada stan terdaftar.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.state.merchants.map(m => `
            <tr>
                <td><img src="${m.foto || m.img || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200'}" class="rounded-3" style="width:40px; height:40px; object-fit:cover;"></td>
                <td class="fw-bold">${m.nama || m.name}</td>
                <td><small class="text-muted">${m.alamat || '-'}</small></td>
                <td>${m.jam_buka || m.hours || '08:00 - 21:00'}</td>
                <td><span class="badge bg-success-subtle text-success">Aktif</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-light text-primary rounded-3 me-1" onclick="adminApp.editMerchant(${m.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-light text-danger rounded-3" onclick="adminApp.deleteMerchant(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },

    openStanModal() {
        document.getElementById('formStan').reset();
        document.getElementById('stanId').value = '';
        document.getElementById('stanFotoExisting').value = '';
        document.getElementById('modalStanTitle').innerText = 'Tambah Stan / Merchant Baru';
        new bootstrap.Modal(document.getElementById('modalStan')).show();
        setTimeout(() => {
            if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 300);
    },

    editMerchant(id) {
        const m = this.state.merchants.find(x => x.id == id);
        if (!m) return;

        document.getElementById('stanId').value = m.id;
        document.getElementById('stanNama').value = m.nama || m.name || '';
        document.getElementById('stanAlamat').value = m.alamat || '';
        document.getElementById('stanLat').value = m.latitude || m.lat || '-7.8543';
        document.getElementById('stanLng').value = m.longitude || m.lng || '111.4678';
        document.getElementById('stanBuka').value = m.jam_buka || m.hours?.split(' - ')[0] || '08:00';
        document.getElementById('stanTutup').value = m.jam_tutup || m.hours?.split(' - ')[1] || '21:00';
        document.getElementById('stanFotoExisting').value = m.foto || m.img || '';
        document.getElementById('stanCategory').value = m.category || 'Makanan';

        document.getElementById('modalStanTitle').innerText = 'Edit Stan / Merchant';
        new bootstrap.Modal(document.getElementById('modalStan')).show();

        setTimeout(() => {
            if (this.mapInstance) {
                this.mapInstance.invalidateSize();
                const lat = parseFloat(document.getElementById('stanLat').value);
                const lng = parseFloat(document.getElementById('stanLng').value);
                if (!isNaN(lat) && !isNaN(lng)) {
                    this.setMarkerPosition(lat, lng, 16);
                }
            }
        }, 300);
    },

    renderOrders() {
        const tbody = document.getElementById('tableOrders');
        if (!tbody) return;
        if (this.state.orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Belum ada pesanan masuk.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.state.orders.map(o => `
            <tr>
                <td class="fw-bold text-primary">${o.id}</td>
                <td>${o.date}</td>
                <td>${o.customer}</td>
                <td>${o.merchant}</td>
                <td class="fw-semibold">Rp ${Number(o.total).toLocaleString('id-ID')}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-danger px-2 py-1 rounded-3 shadow-none" onclick="adminApp.deleteAdminOrder('${o.id}')" title="Hapus Pesanan">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderBanners() {
        const container = document.getElementById('bannerContainer');
        if (!container) return;
        if (this.state.banners.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Belum ada banner.</p>';
            return;
        }

        container.innerHTML = this.state.banners.map(b => `
            <div class="col-12 col-md-4">
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <img src="${b.url}" style="height: 120px; object-fit: cover;">
                    <div class="card-body p-2 text-end">
                        <button class="btn btn-sm btn-light text-danger" onclick="adminApp.deleteBanner(${b.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    openBannerModal() {
        document.getElementById('formBanner').reset();
        new bootstrap.Modal(document.getElementById('modalBanner')).show();
    },

    async saveBanner(e) {
        e.preventDefault();
        const url = document.getElementById('bannerUrlInput').value;
        const title = document.getElementById('bannerTitleInput').value;
        const subtitle = document.getElementById('bannerSubtitleInput').value;

        try {
            const { error } = await dbClient.from('banners').insert([{ 
                url: url, 
                title: title, 
                subtitle: subtitle 
            }]);
            
            if (error) throw error;
            bootstrap.Modal.getInstance(document.getElementById('modalBanner')).hide();
            alert("✅ Banner berhasil ditambahkan!");
            this.fetchAllData();
        } catch (err) {
            alert("❌ Gagal: " + err.message);
        }
    },

    async deleteBanner(id) {
        try {
            const { error } = await dbClient.from('banners').delete().eq('id', id);
            if (error) throw error;
            Swal.fire('Dihapus!', 'Banner dihapus.', 'success');
            this.fetchAllData();
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
        }
    },

    async deleteMerchant(id) {
        const confirm = await Swal.fire({ title: 'Hapus stan?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya' });
        if (confirm.isConfirmed) {
            try {
                const { error } = await dbClient.from('merchants').delete().eq('id', id);
                if (error) throw error;
                Swal.fire('Terhapus!', 'Stan dihapus.', 'success');
                this.fetchAllData();
            } catch (err) {
                Swal.fire('Gagal', err.message, 'error');
            }
        }
    },

    setupEventListeners() {
        const formPengaturan = document.getElementById('formPengaturan');
        if (formPengaturan) {
            formPengaturan.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = formPengaturan.querySelector('button');
                const originalText = btn.innerText;
                btn.innerText = "Menyimpan...";

                try {
                    const wa = document.getElementById('setWa').value.toString();
                    const min = parseFloat(document.getElementById('setMin').value) || 0;
                    const max = parseFloat(document.getElementById('setMax').value) || 0;
                    const service = parseFloat(document.getElementById('setService').value) || 1000;
                    const shippingRate = parseFloat(document.getElementById('setShippingRate').value) || 0;

                    const { error } = await dbClient.from('settings').upsert({
                        id: 1,
                        admin_whatsapp: wa,
                        minimum_fee: min,
                        maximum_fee: max,
                        service_fee: service,
                        shipping_rate_per_km: shippingRate
                    });

                    if (error) throw error;
                    
                    alert("✅ Pengaturan berhasil diupdate!");
                    this.fetchAllData();
                } catch (err) {
                    alert("❌ Gagal menyimpan data!\nPenyebab: " + err.message);
                } finally {
                    btn.innerText = originalText;
                }
            });
        }

        const formStan = document.getElementById('formStan');
        if (formStan) {
            formStan.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = formStan.querySelector('button');
                const originalText = btn.innerText;
                btn.innerText = "Menyimpan...";

                try {
                    const id = document.getElementById('stanId').value;
                    const nama = document.getElementById('stanNama').value;
                    const alamat = document.getElementById('stanAlamat').value;
                    const lat = parseFloat(document.getElementById('stanLat').value);
                    const lng = parseFloat(document.getElementById('stanLng').value);
                    const buka = document.getElementById('stanBuka').value;
                    const tutup = document.getElementById('stanTutup').value;
                    const existingFoto = document.getElementById('stanFotoExisting').value;
                    const fileInput = document.getElementById('stanFile');
                    const kategoriElement = document.getElementById('stanCategory') || document.getElementById('merchantCategory');
                    const kategori = kategoriElement ? kategoriElement.value : 'Makanan';

                    if (isNaN(lat) || isNaN(lng)) {
                        throw new Error("Silakan tentukan titik lokasi pada peta terlebih dahulu.");
                    }

                    let fotoFinal = existingFoto || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600';
                    if (fileInput.files && fileInput.files[0]) {
                        fotoFinal = await this.toBase64(fileInput.files[0]);
                    }

                    const payload = {
                        nama: nama,
                        name: nama,
                        category: kategori,
                        foto: fotoFinal,
                        img: fotoFinal,
                        alamat: alamat,
                        latitude: lat,
                        lat: lat.toString(),
                        longitude: lng,
                        lng: lng.toString(),
                        jam_buka: buka,
                        jam_tutup: tutup,
                        hours: `${buka} - ${tutup}`,
                        status_buka: true
                    };

                    if (id) {
                        const { error } = await dbClient.from('merchants').update(payload).eq('id', id);
                        if (error) throw error;
                    } else {
                        const { error } = await dbClient.from('merchants').insert([payload]);
                        if (error) throw error;
                    }

                    Swal.fire("Berhasil!", "Data stan berhasil disimpan!", "success");
                    bootstrap.Modal.getInstance(document.getElementById('modalStan')).hide();
                    this.fetchAllData();
                } catch (err) {
                    Swal.fire("Gagal", err.message, "error");
                } finally {
                    btn.innerText = originalText;
                }
            });
        }
    },

    toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    setMarkerPosition(lat, lng, zoom = 16) {
        document.getElementById('stanLat').value = lat;
        document.getElementById('stanLng').value = lng;
        if (this.mapInstance) {
            this.mapInstance.setView([lat, lng], zoom);
            if (this.mapMarker) {
                this.mapMarker.setLatLng([lat, lng]);
            } else {
                this.mapMarker = L.marker([lat, lng], { draggable: true }).addTo(this.mapInstance);
                this.mapMarker.on('dragend', () => {
                    const pos = this.mapMarker.getLatLng();
                    document.getElementById('stanLat').value = pos.lat;
                    document.getElementById('stanLng').value = pos.lng;
                });
            }
        }
    },

    initLeafletMap() {
        const defaultLat = -7.8543;
        const defaultLng = 111.4678;

        const mapContainer = document.getElementById('interactiveMap');
        if (mapContainer && typeof L !== 'undefined') {
            const map = L.map('interactiveMap').setView([defaultLat, defaultLng], 15);
            this.mapInstance = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            map.on('click', (e) => {
                this.setMarkerPosition(e.latlng.lat, e.latlng.lng, map.getZoom());
            });

            const btnGetGps = document.getElementById('btnGetGps');
            if (btnGetGps) {
                btnGetGps.addEventListener('click', () => {
                    if (!navigator.geolocation) {
                        alert("Browser Anda tidak mendeteksi GPS.");
                        return;
                    }
                    btnGetGps.innerText = "Mencari Lokasi...";
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            this.setMarkerPosition(position.coords.latitude, position.coords.longitude, 18);
                            btnGetGps.innerText = "📍 Gunakan GPS HP Saya";
                            Swal.fire({ icon: 'success', title: 'GPS Ditemukan!', timer: 1500, showConfirmButton: false });
                        },
                        () => {
                            alert("Gagal mendeteksi GPS. Periksa izin lokasi browser Anda.");
                            btnGetGps.innerText = "📍 Gunakan GPS HP Saya";
                        },
                        { enableHighAccuracy: true, timeout: 10000 }
                    );
                });
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => adminApp.init());