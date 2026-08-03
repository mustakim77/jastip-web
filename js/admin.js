/**
 * JASTIP SAWOO - ADMIN JS (3 Independent File Inputs & Base64 Fix)
 */

const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adminApp = {
    state: {
        merchants: [],
        orders: [],
        banners: [],
        settings: {},
        currentPhotos: ['', '', ''] // Array penampung 3 foto [Foto1, Foto2, Foto3]
    },

    mapInstance: null,
    mapMarker: null,

    async init() {
        this.setupSidebarToggle();
        this.renderTableSkeletons();
        await this.fetchAllData();
        this.setupEventListeners();
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
            'merchant': 'Kelola Stan',
            'pesanan': 'Pesanan Masuk',
            'banner': 'Banner Promosi',
            'pengaturan': 'Pengaturan Tarif'
        };
        document.getElementById('pageTitle').innerText = titles[targetId] || 'Admin Panel';

        if (window.innerWidth <= 768) {
            document.getElementById('wrapper').classList.remove('toggled');
        }
    },

    renderTableSkeletons() {
        const tbodyM = document.getElementById('tableMerchants');
        if (tbodyM) {
            tbodyM.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3"><i class="fa-solid fa-spinner fa-spin me-2"></i>Memuat data stan...</td></tr>`;
        }
        const tbodyO = document.getElementById('tableOrders');
        if (tbodyO) {
            tbodyO.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3"><i class="fa-solid fa-spinner fa-spin me-2"></i>Memuat data pesanan...</td></tr>`;
        }
    },

    // Helper Parse String Foto Aman dari Pemisahan Base64
    parsePhotoString(str) {
        if (!str) return [];
        if (str.includes('|||')) {
            return str.split('|||').map(s => s.trim()).filter(Boolean);
        }
        if (str.includes('data:image/')) {
            const matches = str.match(/data:image\/[^;]+;base64,[^|,]+/g);
            if (matches && matches.length > 0) return matches;
        }
        return str.split(',').map(s => s.trim()).filter(Boolean);
    },

    async fetchAllData() {
        try {
            const [mRes, oRes, bRes, sRes] = await Promise.all([
                dbClient.from('merchants').select('id, nama, name, alamat, jam_buka, hours, foto, img, category, latitude, lat, longitude, lng').order('id', { ascending: false }),
                dbClient.from('orders').select('id, date, customer, merchant, total').order('date', { ascending: false }),
                dbClient.from('banners').select('id, url, title, subtitle').order('id', { ascending: false }),
                dbClient.from('settings').select('admin_whatsapp, minimum_fee, maximum_fee, service_fee, shipping_rate_per_km').eq('id', 1).maybeSingle()
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
            this.updateCategoryDatalist();

        } catch (err) {
            console.error('Gagal memuat data admin:', err);
        }
    },

    updateCategoryDatalist() {
        const datalist = document.getElementById('categoryList');
        if (!datalist) return;

        const existingCategories = [...new Set(this.state.merchants.map(m => m.category || m.kategori).filter(Boolean))];
        const defaultCategories = ['Makanan', 'Minuman', 'Snack', 'Sembako', 'Jasa'];
        const allCategories = [...new Set([...defaultCategories, ...existingCategories])];

        datalist.innerHTML = allCategories.map(cat => `<option value="${cat}">`).join('');
    },

    renderDashboard() {
        document.getElementById('stat-orders').innerText = this.state.orders.length;
        document.getElementById('stat-merchants').innerText = this.state.merchants.length;
        
        const feePerOrder = Number(this.state.settings.service_fee || 0);
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

        tbody.innerHTML = this.state.merchants.map(m => {
            const images = this.parsePhotoString(m.foto || m.img || '');
            const firstImg = images[0] || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200';
            const imgCount = images.length;

            return `
            <tr>
                <td>
                    <div class="position-relative d-inline-block">
                        <img src="${firstImg}" class="rounded-3" style="width:40px; height:40px; object-fit:cover; background-color:#f8f9fa;" loading="lazy">
                        ${imgCount > 1 ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary" style="font-size:0.55rem;">${imgCount}</span>` : ''}
                    </div>
                </td>
                <td class="fw-bold">${m.nama || m.name}</td>
                <td><small class="text-muted">${m.alamat || '-'}</small></td>
                <td>${m.jam_buka || m.hours || '08:00 - 21:00'}</td>
                <td><span class="badge bg-success-subtle text-success">Aktif</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-light text-primary rounded-3 me-1" onclick="adminApp.editMerchant(${m.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-light text-danger rounded-3" onclick="adminApp.deleteMerchant(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
            `;
        }).join('');
    },

    openStanModal() {
        document.getElementById('formStan').reset();
        document.getElementById('stanId').value = '';
        document.getElementById('stanFotoExisting').value = '';
        this.resetFileInputs();
        this.state.currentPhotos = ['', '', ''];
        this.renderPhotoPreviews();

        document.getElementById('modalStanTitle').innerText = 'Tambah Stan / Merchant Baru';
        new bootstrap.Modal(document.getElementById('modalStan')).show();

        setTimeout(() => {
            this.ensureMapInitialized();
            this.setMarkerPosition(-7.8543, 111.4678, 15);
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

        const existingFotoStr = m.foto || m.img || '';
        document.getElementById('stanFotoExisting').value = existingFotoStr;
        document.getElementById('stanCategory').value = m.category || 'Makanan';

        this.resetFileInputs();
        const parsed = this.parsePhotoString(existingFotoStr);
        this.state.currentPhotos = [
            parsed[0] || '',
            parsed[1] || '',
            parsed[2] || ''
        ];
        this.renderPhotoPreviews();

        document.getElementById('modalStanTitle').innerText = 'Edit Stan / Merchant';
        new bootstrap.Modal(document.getElementById('modalStan')).show();

        setTimeout(() => {
            this.ensureMapInitialized();
            const lat = parseFloat(document.getElementById('stanLat').value);
            const lng = parseFloat(document.getElementById('stanLng').value);
            if (!isNaN(lat) && !isNaN(lng)) {
                this.setMarkerPosition(lat, lng, 16);
            }
        }, 300);
    },

    resetFileInputs() {
        for (let i = 1; i <= 3; i++) {
            const input = document.getElementById(`stanFile${i}`);
            if (input) input.value = '';
        }
    },

    // Memproses Input File Terpisah
    async handleFileInput(input, index) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        const compressedBase64 = await this.compressImage(file);
        this.state.currentPhotos[index] = compressedBase64;
        this.renderPhotoPreviews();
    },

    // Render Pratinjau Foto pada Masing-Masing Box
    renderPhotoPreviews() {
        for (let i = 0; i < 3; i++) {
            const container = document.getElementById(`previewBox${i}`);
            if (!container) continue;

            const url = this.state.currentPhotos[i];
            if (url) {
                container.innerHTML = `
                    <div class="position-relative d-inline-block" style="width:100%; height:75px;">
                        <img src="${url}" class="rounded-3 border shadow-sm w-100 h-100" style="object-fit:cover;">
                        <button type="button" 
                                class="btn btn-danger btn-sm position-absolute top-0 start-100 translate-middle rounded-circle p-0 d-flex align-items-center justify-content-center shadow" 
                                style="width:20px; height:20px; font-size:11px;" 
                                onclick="adminApp.removeSinglePhoto(${i})" title="Hapus foto ini">
                            &times;
                        </button>
                    </div>
                `;
            } else {
                container.innerHTML = '';
            }
        }
    },

    // Hapus Foto pada Kolom Tertentu
    removeSinglePhoto(index) {
        this.state.currentPhotos[index] = '';
        const input = document.getElementById(`stanFile${index + 1}`);
        if (input) input.value = '';
        this.renderPhotoPreviews();
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
                    <img src="${b.url}" style="height: 120px; object-fit: cover;" loading="lazy">
                    <div class="card-body p-2 d-flex justify-content-between align-items-center">
                        <span class="small fw-bold text-truncate text-muted">${b.title || 'Banner'}</span>
                        <div>
                            <button class="btn btn-sm btn-light text-primary me-1 rounded-3" onclick="adminApp.editBanner(${b.id})" title="Edit Banner"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-sm btn-light text-danger rounded-3" onclick="adminApp.deleteBanner(${b.id})" title="Hapus Banner"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    openBannerModal() {
        const form = document.getElementById('formBanner');
        if (form) form.reset();
        const bannerIdInput = document.getElementById('bannerId');
        if (bannerIdInput) bannerIdInput.value = '';
        const modalTitle = document.getElementById('modalBannerTitle');
        if (modalTitle) modalTitle.innerText = 'Tambah Banner Slider';
        const btnSubmit = document.getElementById('btnBannerSubmit');
        if (btnSubmit) btnSubmit.innerText = 'Upload Banner';
        
        const modalEl = document.getElementById('modalBanner');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    },

    editBanner(id) {
        const b = this.state.banners.find(x => x.id == id);
        if (!b) return;

        const bannerIdInput = document.getElementById('bannerId');
        if (bannerIdInput) bannerIdInput.value = b.id;
        const urlInput = document.getElementById('bannerUrlInput');
        if (urlInput) urlInput.value = b.url || '';
        const titleInput = document.getElementById('bannerTitleInput');
        if (titleInput) titleInput.value = b.title || '';
        const subtitleInput = document.getElementById('bannerSubtitleInput');
        if (subtitleInput) subtitleInput.value = b.subtitle || '';

        const modalTitle = document.getElementById('modalBannerTitle');
        if (modalTitle) modalTitle.innerText = 'Edit Banner Slider';
        const btnSubmit = document.getElementById('btnBannerSubmit');
        if (btnSubmit) btnSubmit.innerText = 'Simpan Perubahan';

        const modalEl = document.getElementById('modalBanner');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    },

    async saveBanner(e) {
        e.preventDefault();
        const bannerIdInput = document.getElementById('bannerId');
        const id = bannerIdInput ? bannerIdInput.value : '';
        const url = document.getElementById('bannerUrlInput').value;
        const title = document.getElementById('bannerTitleInput').value;
        const subtitle = document.getElementById('bannerSubtitleInput').value;

        try {
            if (id) {
                const { error } = await dbClient.from('banners').update({ 
                    url: url, 
                    title: title, 
                    subtitle: subtitle 
                }).eq('id', id);
                
                if (error) throw error;
                Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Banner berhasil diupdate!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
            } else {
                const { error } = await dbClient.from('banners').insert([{ 
                    url: url, 
                    title: title, 
                    subtitle: subtitle 
                }]);
                
                if (error) throw error;
                Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Banner berhasil ditambahkan!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
            }

            const modalEl = document.getElementById('modalBanner');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            this.fetchAllData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
        }
    },

    async deleteBanner(id) {
        try {
            const { error } = await dbClient.from('banners').delete().eq('id', id);
            if (error) throw error;
            Swal.fire({ icon: 'success', title: 'Dihapus!', text: 'Banner berhasil dihapus.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
            this.fetchAllData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
        }
    },

    async deleteMerchant(id) {
        const confirm = await Swal.fire({ title: 'Hapus stan?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya', customClass: { popup: 'rounded-4' } });
        if (confirm.isConfirmed) {
            try {
                const { error } = await dbClient.from('merchants').delete().eq('id', id);
                if (error) throw error;
                Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Stan dihapus.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
                this.fetchAllData();
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
            }
        }
    },

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
            customClass: { popup: 'rounded-4 shadow-lg border-0' }
        });

        if (!isConfirmed) return;

        if (passwordInput !== "koirul07") {
            Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Password khusus salah!', confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
            return;
        }

        try {
            const { error } = await dbClient.from('orders').delete().eq('id', orderId);
            if (error) throw error;
            Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Pesanan berhasil dihapus.', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
            this.fetchAllData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
        }
    },

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
            customClass: { popup: 'rounded-4 shadow-lg border-0' }
        });

        if (!isConfirmed) return;

        if (passwordInput !== "koirul07") {
            Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Password salah!', confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
            return;
        }

        try {
            const { data: allOrders, error: fetchError } = await dbClient.from('orders').select('id');
            if (fetchError) throw fetchError;

            if (!allOrders || allOrders.length === 0) return;

            const idsToDelete = allOrders.map(o => o.id);
            const { error } = await dbClient.from('orders').delete().in('id', idsToDelete);
            if (error) throw error;

            Swal.fire({ icon: 'success', title: 'Dikosongkan!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
            this.fetchAllData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
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
                    
                    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Pengaturan berhasil diupdate!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
                    this.fetchAllData();
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
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
                    const kategoriElement = document.getElementById('stanCategory') || document.getElementById('merchantCategory');
                    const kategori = kategoriElement ? kategoriElement.value : 'Makanan';

                    if (isNaN(lat) || isNaN(lng)) {
                        throw new Error("Silakan tentukan titik lokasi pada peta terlebih dahulu.");
                    }

                    // Ambil foto-foto aktif dan gabung dengan pemisah '|||'
                    const activePhotos = this.state.currentPhotos.filter(Boolean);
                    let fotoFinal = activePhotos.length > 0 
                        ? activePhotos.join('|||') 
                        : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600';

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

                    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data stan berhasil disimpan!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
                    bootstrap.Modal.getInstance(document.getElementById('modalStan')).hide();
                    this.fetchAllData();
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, confirmButtonColor: '#007AFF', customClass: { popup: 'rounded-4' } });
                } finally {
                    btn.innerText = originalText;
                }
            });
        }
    },

    compressImage(file, maxWidth = 600, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    },

    ensureMapInitialized() {
        const mapContainer = document.getElementById('interactiveMap');
        if (!mapContainer || typeof L === 'undefined') return;

        if (!this.mapInstance) {
            const defaultLat = -7.8543;
            const defaultLng = 111.4678;

            this.mapInstance = L.map('interactiveMap').setView([defaultLat, defaultLng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(this.mapInstance);

            this.mapInstance.on('click', (e) => {
                this.setMarkerPosition(e.latlng.lat, e.latlng.lng, this.mapInstance.getZoom());
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
                            Swal.fire({ icon: 'success', title: 'GPS Ditemukan!', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
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
        this.mapInstance.invalidateSize();
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
    }
};

document.addEventListener('DOMContentLoaded', () => adminApp.init());