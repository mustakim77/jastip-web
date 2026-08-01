/**
 * JASTIP WEB - ADMIN JS
 * Terintegrasi dengan Supabase Asli
 */

// Konfigurasi Supabase
const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';

// Inisialisasi SDK Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        
        // Panggil fetch awal dari Supabase
        this.fetchDashboardData();
    },

    // --- NAVIGATION ---
    setupNavigation() {
        const links = document.querySelectorAll('.nav-link[data-target]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');
                
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
                document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
                
                const targetSec = document.getElementById(`sec-${target}`);
                if(targetSec) {
                    targetSec.classList.add('active');
                    targetSec.classList.remove('hidden');
                }
            });
        });
    },

    // --- SUPABASE API CALLS ---
    async fetchDashboardData() {
        try {
            // Ambil semua data secara paralel (Asynchronous)
            const [merchRes, orderRes, setRes, bannerRes] = await Promise.all([
                supabase.from('merchants').select('*').order('id', { ascending: false }),
                supabase.from('orders').select('*').order('date', { ascending: false }),
                supabase.from('settings').select('*').limit(1).maybeSingle(),
                supabase.from('banners').select('*').order('id', { ascending: false })
            ]);

            this.state.merchants = merchRes.data || [];
            this.state.orders = orderRes.data || [];
            this.state.banners = bannerRes.data || [];
            
            // Jika tabel settings kosong, gunakan default
            this.state.settings = setRes.data || { ongkir: 2500, adminFee: 2000, wa: '6281234567890', radius: 15, logo: '' };

            this.renderAll();
        } catch (error) {
            this.showToast('Gagal memuat data dari server Supabase.');
            console.error("Fetch Data Error:", error);
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
            if (order.status !== 'Dibatalkan') return sum + Number(this.state.settings.adminFee);
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
                <td><span class="badge ${m.status ? m.status.toLowerCase() : 'aktif'}">${m.status || 'Aktif'}</span></td>
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

        try {
            if (id) {
                // Update
                const { error } = await supabase.from('merchants').update(payload).eq('id', id);
                if (error) throw error;
                this.showToast("Data Merchant berhasil diperbarui!");
            } else {
                // Insert
                const { error } = await supabase.from('merchants').insert([payload]);
                if (error) throw error;
                this.showToast("Merchant baru berhasil ditambahkan!");
            }
            this.closeModal('merchant-modal');
            this.fetchDashboardData();
        } catch(err) {
            this.showToast("Terjadi kesalahan saat menyimpan merchant.");
            console.error(err);
        }
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
        try {
            const { error } = await supabase.from('merchants').delete().eq('id', id);
            if (error) throw error;
            this.showToast("Merchant berhasil dihapus.");
            this.fetchDashboardData();
        } catch(err) {
            this.showToast("Gagal menghapus merchant.");
            console.error(err);
        }
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
                <td>Rp ${Number(o.total).toLocaleString('id-ID')}</td>
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
        try {
            const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            this.showToast(`Status pesanan ${id} diperbarui.`);
            this.fetchDashboardData(); 
        } catch(err) {
            this.showToast("Gagal memperbarui status pesanan.");
            console.error(err);
        }
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
        try {
            const { error } = await supabase.from('banners').insert([{ url }]);
            if(error) throw error;
            this.showToast("Banner berhasil ditambahkan!");
            document.getElementById('form-banner').reset();
            this.closeModal('banner-modal');
            this.fetchDashboardData();
        } catch(err) {
            this.showToast("Gagal menambahkan banner.");
            console.error(err);
        }
    },

    async deleteBanner(id) {
        if(!confirm("Hapus banner ini dari slider utama?")) return;
        try {
            const { error } = await supabase.from('banners').delete().eq('id', id);
            if(error) throw error;
            this.showToast("Banner dihapus.");
            this.fetchDashboardData();
        } catch (err) {
            this.showToast("Gagal menghapus banner.");
            console.error(err);
        }
    },

    // --- SETTINGS ---
    renderSettings() {
        const s = this.state.settings;
        document.getElementById('set-ongkir').value = s.ongkir || 2500;
        document.getElementById('set-admin-fee').value = s.adminFee || 2000;
        document.getElementById('set-wa').value = s.wa || '6281234567890';
        document.getElementById('set-radius').value = s.radius || 15;
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

        try {
            // Karena tabel setting biasanya cuma butuh 1 baris, kita gunakan pendekatan update/upsert (ID = 1)
            const { error } = await supabase.from('settings').upsert({ id: 1, ...payload });
            if(error) throw error;
            this.showToast("Pengaturan sistem berhasil diperbarui!");
            this.fetchDashboardData();
        } catch (err) {
            this.showToast("Gagal menyimpan pengaturan.");
            console.error(err);
        }
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

document.addEventListener('DOMContentLoaded', () => adminApp.init());