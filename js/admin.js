/**
 * JASTIP WEB - ADMIN JS
 * Requirement: ES6, Supabase SDK, Vanilla JS, Modular, Production-ready
 */

// Konfigurasi Supabase
const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';
// const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adminApp = {
    state: {
        merchants: [],
        orders: [],
        settings: {},
        banners: []
    },

    init() {
        lucide.createIcons();
        this.setupNavigation();
        this.setupForms();
        
        // Panggil fetch awal
        this.fetchDashboardData();
    },

    // --- NAVIGATION ---
    setupNavigation() {
        const links = document.querySelectorAll('.nav-link[data-target]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');
                
                // Update active class UI
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Switch section
                document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden', 'active'));
                document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
                document.getElementById(`sec-${target}`).classList.add('active');
                document.getElementById(`sec-${target}`).classList.remove('hidden');
            });
        });
    },

    // --- SUPABASE API CALLS (SIMULATED FOR PREVIEW) ---
    async fetchDashboardData() {
        try {
            // SINTAKS PRODUKSI (Uncomment bila Key sudah dimasukkan):
            // const { data: mData } = await supabase.from('merchants').select('*');
            // const { data: oData } = await supabase.from('orders').select('*');
            // const { data: sData } = await supabase.from('settings').select('*').single();
            // const { data: bData } = await supabase.from('banners').select('*');

            // MOCK DATA (Agar siap jalan di VS Code)
            this.state.merchants = [
                { id: 1, name: 'Sate Ayam Ponorogo', category: 'Makanan', lat: -7.868, lng: 111.464, img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200', status: 'Aktif' },
                { id: 2, name: 'Boba Time', category: 'Minuman', lat: -7.870, lng: 111.465, img: 'https://images.unsplash.com/photo-1558857563-b37102e9976c?w=200', status: 'Aktif' }
            ];
            this.state.orders = [
                { id: 'ORD-001', date: '2026-08-01', customer: 'Budi Santoso', merchant: 'Sate Ayam Ponorogo', total: 45000, status: 'Menunggu' },
                { id: 'ORD-002', date: '2026-08-01', customer: 'Siti Aminah', merchant: 'Boba Time', total: 28000, status: 'Diproses' }
            ];
            this.state.settings = { ongkir: 2500, adminFee: 2000, wa: '6281234567890', radius: 15, logo: '' };
            this.state.banners = [
                { id: 1, url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600' }
            ];

            this.renderAll();
        } catch (error) {
            this.showToast('Gagal memuat data dari server.');
            console.error(error);
        }
    },

    renderAll() {
        this.renderDashboardStats();
        this.renderMerchants();
        this.renderOrders();
        this.renderSettings();
        this.renderBanners();
    },

    renderDashboardStats() {
        document.getElementById('stat-orders').innerText = this.state.orders.length;
        document.getElementById('stat-merchants').innerText = this.state.merchants.length;
        
        const revenue = this.state.orders.reduce((sum, order) => {
            if (order.status !== 'Dibatalkan') return sum + this.state.settings.adminFee;
            return sum;
        }, 0);
        document.getElementById('stat-revenue').innerText = `Rp ${revenue.toLocaleString('id-ID')}`;
    },

    // --- MERCHANT MANAGEMENT ---
    renderMerchants() {
        const tbody = document.getElementById('table-merchants');
        tbody.innerHTML = this.state.merchants.map(m => `
            <tr>
                <td><img src="${m.img}" class="table-img" alt="Foto"></td>
                <td class="fw-bold">${m.name}</td>
                <td>${m.category}</td>
                <td>${m.lat}, ${m.lng}</td>
                <td><span class="badge ${m.status.toLowerCase()}">${m.status}</span></td>
                <td>
                    <button class="btn-icon" onclick="adminApp.editMerchant(${m.id})"><i data-lucide="edit-2"></i></button>
                    <button class="btn-icon delete" onclick="adminApp.deleteMerchant(${m.id})"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    async saveMerchant(e) {
        e.preventDefault();
        const id = document.getElementById('merch-id').value;
        const payload = {
            name: document.getElementById('merch-name').value,
            category: document.getElementById('merch-category').value,
            hours: document.getElementById('merch-hours').value,
            lat: document.getElementById('merch-lat').value,
            lng: document.getElementById('merch-lng').value,
            img: document.getElementById('merch-img').value,
            status: 'Aktif'
        };

        // PRODUCTION DB LOGIC:
        // if(id) await supabase.from('merchants').update(payload).eq('id', id);
        // else await supabase.from('merchants').insert([payload]);

        this.showToast("Data Merchant berhasil disimpan!");
        this.closeModal('merchant-modal');
        this.fetchDashboardData(); // Reload data
    },

    editMerchant(id) {
        const m = this.state.merchants.find(x => x.id === id);
        if(!m) return;
        
        document.getElementById('merch-id').value = m.id;
        document.getElementById('merch-name').value = m.name;
        document.getElementById('merch-category').value = m.category;
        document.getElementById('merch-hours').value = m.hours || '08:00 - 20:00';
        document.getElementById('merch-lat').value = m.lat;
        document.getElementById('merch-lng').value = m.lng;
        document.getElementById('merch-img').value = m.img;
        
        this.openModal('merchant-modal');
    },

    async deleteMerchant(id) {
        if(!confirm("Yakin ingin menghapus merchant ini?")) return;
        // await supabase.from('merchants').delete().eq('id', id);
        this.showToast("Merchant dihapus.");
        this.fetchDashboardData();
    },

    // --- ORDER MANAGEMENT ---
    renderOrders() {
        const tbody = document.getElementById('table-orders');
        tbody.innerHTML = this.state.orders.map(o => `
            <tr>
                <td class="fw-bold">${o.id}</td>
                <td>${o.date}</td>
                <td>${o.customer}</td>
                <td>${o.merchant}</td>
                <td>Rp ${o.total.toLocaleString('id-ID')}</td>
                <td>
                    <select class="status-select" onchange="adminApp.updateOrderStatus('${o.id}', this.value)">
                        <option value="Menunggu" ${o.status === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
                        <option value="Diproses" ${o.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                        <option value="Selesai" ${o.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                        <option value="Dibatalkan" ${o.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
                    </select>
                </td>
                <td>
                    <button class="btn-icon" title="Lihat Detail"><i data-lucide="eye"></i></button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    },

    async updateOrderStatus(id, newStatus) {
        // await supabase.from('orders').update({ status: newStatus }).eq('id', id);
        this.showToast(`Status ${id} diubah menjadi ${newStatus}`);
        this.fetchDashboardData(); // Refresh to update revenue stats
    },

    // --- BANNER MANAGEMENT ---
    renderBanners() {
        const grid = document.getElementById('banner-list');
        grid.innerHTML = this.state.banners.map(b => `
            <div class="banner-card">
                <img src="${b.url}" alt="Banner">
                <button class="btn-delete-banner" onclick="adminApp.deleteBanner(${b.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    },

    async addBanner(e) {
        e.preventDefault();
        const url = document.getElementById('banner-url').value;
        // await supabase.from('banners').insert([{ url }]);
        this.showToast("Banner ditambahkan!");
        document.getElementById('form-banner').reset();
        this.closeModal('banner-modal');
        this.fetchDashboardData();
    },

    async deleteBanner(id) {
        if(!confirm("Hapus banner ini?")) return;
        // await supabase.from('banners').delete().eq('id', id);
        this.showToast("Banner dihapus.");
        this.fetchDashboardData();
    },

    // --- SETTINGS ---
    renderSettings() {
        const s = this.state.settings;
        document.getElementById('set-ongkir').value = s.ongkir;
        document.getElementById('set-admin-fee').value = s.adminFee;
        document.getElementById('set-wa').value = s.wa;
        document.getElementById('set-radius').value = s.radius;
        document.getElementById('set-logo').value = s.logo || '';
    },

    async saveSettings(e) {
        e.preventDefault();
        const payload = {
            ongkir: document.getElementById('set-ongkir').value,
            adminFee: document.getElementById('set-admin-fee').value,
            wa: document.getElementById('set-wa').value,
            radius: document.getElementById('set-radius').value,
            logo: document.getElementById('set-logo').value
        };
        // await supabase.from('settings').update(payload).eq('id', 1);
        this.showToast("Pengaturan sistem berhasil diperbarui!");
    },

    // --- UTILITIES ---
    setupForms() {
        document.getElementById('form-merchant').addEventListener('submit', (e) => this.saveMerchant(e));
        document.getElementById('form-settings').addEventListener('submit', (e) => this.saveSettings(e));
        document.getElementById('form-banner').addEventListener('submit', (e) => this.addBanner(e));
    },

    openModal(id) {
        if (id === 'merchant-modal' && !document.getElementById('merch-id').value) {
            document.getElementById('form-merchant').reset();
        }
        document.getElementById(id).classList.remove('hidden');
    },

    closeModal(id) {
        document.getElementById(id).classList.add('hidden');
        if (id === 'merchant-modal') document.getElementById('form-merchant').reset();
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    logout() {
        this.showToast("Keluar dari panel admin...");
        setTimeout(() => window.location.href = 'index.html', 1000);
    }
};

// Start Admin App
document.addEventListener('DOMContentLoaded', () => adminApp.init());