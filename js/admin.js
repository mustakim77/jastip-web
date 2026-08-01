const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await verifyAdmin();
    initAdminNavigation();
    loadDashboardStats();
    loadAdminMerchants();
    loadAdminOrders();
    loadSettings();
    initMerchantCrud();
    initSettingsForm();
});

function showAdminToast(message) {
    const toast = document.getElementById('adminToast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function verifyAdmin() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
        alert('Akses ditolak. Anda bukan admin.');
        window.location.href = 'index.html';
    }
}

function initAdminNavigation() {
    const links = document.querySelectorAll('.sidebar-link[data-target]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

async function loadDashboardStats() {
    const { count: merchantCount } = await supabase.from('merchants').select('*', { count: 'exact', head: true });
    const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: completedCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'Selesai');
    
    const { data: orders } = await supabase.from('orders').select('total').eq('status', 'Selesai');
    const totalPendapatan = orders ? orders.reduce((sum, o) => sum + o.total, 0) : 0;

    document.getElementById('statTotalMerchant').textContent = merchantCount || 0;
    document.getElementById('statTotalOrder').textContent = orderCount || 0;
    document.getElementById('statCompletedOrder').textContent = completedCount || 0;
    document.getElementById('statTotalPendapatan').textContent = `Rp ${totalPendapatan.toLocaleString()}`;
}

async function loadAdminMerchants() {
    const { data: merchants, error } = await supabase.from('merchants').select('*');
    if (error) return;

    const tbody = document.getElementById('merchantTableBody');
    tbody.innerHTML = merchants.map(m => `
        <tr>
            <td><img src="${m.foto || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
            <td>${m.nama}</td>
            <td>${m.kategori}</td>
            <td><span class="badge ${m.status.toLowerCase()}">${m.status}</span></td>
            <td>
                <button class="btn-secondary" onclick="editMerchant('${m.id}')">Edit</button>
                <button class="btn-secondary" style="background:#FEE2E2; color:#DC2626;" onclick="deleteMerchant('${m.id}')">Hapus</button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

document.getElementById('openAddMerchantModalBtn').addEventListener('click', () => {
    document.getElementById('adminMerchantForm').reset();
    document.getElementById('editMerchantId').value = '';
    document.getElementById('merchantModalTitle').textContent = 'Tambah Merchant';
    document.getElementById('adminMerchantModal').classList.add('show');
});

document.getElementById('closeAdminMerchantModal').addEventListener('click', () => {
    document.getElementById('adminMerchantModal').classList.remove('show');
});

function initMerchantCrud() {
    const form = document.getElementById('adminMerchantForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editMerchantId').value;
        const nama = document.getElementById('merchantNama').value;
        const kategori = document.getElementById('merchantKategori').value;
        const alamat = document.getElementById('merchantAlamat').value;
        const latitude = parseFloat(document.getElementById('merchantLatitude').value);
        const longitude = parseFloat(document.getElementById('merchantLongitude').value);
        const jam_buka = document.getElementById('merchantJamBuka').value;
        const jam_tutup = document.getElementById('merchantJamTutup').value;
        const status = document.getElementById('merchantStatus').value;

        const payload = { nama, kategori, alamat, latitude, longitude, jam_buka, jam_tutup, status };

        let error;
        if (id) {
            const res = await supabase.from('merchants').update(payload).eq('id', id);
            error = res.error;
        } else {
            const res = await supabase.from('merchants').insert([payload]);
            error = res.error;
        }

        if (error) {
            showAdminToast('Gagal menyimpan merchant');
        } else {
            showAdminToast('Merchant berhasil disimpan');
            document.getElementById('adminMerchantModal').classList.remove('show');
            loadAdminMerchants();
            loadDashboardStats();
        }
    });
}

async function deleteMerchant(id) {
    if (confirm('Yakin ingin menghapus merchant ini?')) {
        const { error } = await supabase.from('merchants').delete().eq('id', id);
        if (error) {
            showAdminToast('Gagal menghapus merchant');
        } else {
            showAdminToast('Merchant berhasil dihapus');
            loadAdminMerchants();
            loadDashboardStats();
        }
    }
}

async function loadAdminOrders() {
    const { data: orders, error } = await supabase.from('orders').select('*');
    if (error) return;

    const tbody = document.getElementById('adminOrderTableBody');
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td>${o.invoice}</td>
            <td>${o.nama}</td>
            <td>${o.daftar_pesanan}</td>
            <td>Rp ${o.total.toLocaleString()}</td>
            <td><span class="badge buka">${o.status}</span></td>
            <td>
                <select onchange="updateOrderStatus('${o.id}', this.value)">
                    <option value="Menunggu" ${o.status === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
                    <option value="Diproses" ${o.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                    <option value="Sedang Dibelikan" ${o.status === 'Sedang Dibelikan' ? 'selected' : ''}>Sedang Dibelikan</option>
                    <option value="Menuju Pelanggan" ${o.status === 'Menuju Pelanggan' ? 'selected' : ''}>Menuju Pelanggan</option>
                    <option value="Selesai" ${o.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    <option value="Dibatalkan" ${o.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
                </select>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
        showAdminToast('Gagal mengubah status pesanan');
    } else {
        showAdminToast('Status pesanan diperbarui');
        loadDashboardStats();
    }
}

async function loadSettings() {
    const { data: settings } = await supabase.from('settings').select('*').single();
    if (settings) {
        document.getElementById('settingAdminWhatsapp').value = settings.admin_whatsapp || '';
        document.getElementById('settingTarifPerKm').value = settings.tarif_per_km || '';
        document.getElementById('settingBiayaAdmin').value = settings.biaya_admin || '';
        document.getElementById('settingRadiusMaksimal').value = settings.radius_maksimal || '';
        document.getElementById('settingNamaWebsite').value = settings.nama_website || '';
    }
}

function initSettingsForm() {
    const form = document.getElementById('settingsForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const admin_whatsapp = document.getElementById('settingAdminWhatsapp').value;
        const tarif_per_km = parseFloat(document.getElementById('settingTarifPerKm').value);
        const biaya_admin = parseFloat(document.getElementById('settingBiayaAdmin').value);
        const radius_maksimal = parseFloat(document.getElementById('settingRadiusMaksimal').value);
        const nama_website = document.getElementById('settingNamaWebsite').value;

        const { error } = await supabase.from('settings').update({
            admin_whatsapp, tarif_per_km, biaya_admin, radius_maksimal, nama_website
        }).eq('id', 1); // Assuming single settings row ID 1

        if (error) {
            showAdminToast('Gagal menyimpan pengaturan');
        } else {
            showAdminToast('Pengaturan berhasil diperbarui');
        }
    });
}