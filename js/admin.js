const SUPABASE_URL = 'https://lxqpbpzsufgnjmimbaly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cXBicHpzdWZnbmptaW1iYWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU1MTgsImV4cCI6MjEwMTEwMTUxOH0.kUqq8XLCJ6IZHNGVedk_mFZQlDVlCJ1-TheYq4v2988';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initNavigation();
    loadHomeData();
    initAuth();
    initOrderForm();
});

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'pesanan-view') {
                loadOrderHistory();
            } else if (targetId === 'member-view') {
                checkAuthStatus();
            }
        });
    });
}

async function loadHomeData() {
    try {
        const { data: merchants, error } = await supabase.from('merchants').select('*');
        if (error) throw error;

        renderMerchantGrids(merchants);
        initSearch(merchants);
    } catch (err) {
        console.error('Error loading home data:', err);
    }
}

function renderMerchantGrids(merchants) {
    const popularGrid = document.getElementById('popularMerchantGrid');
    const latestGrid = document.getElementById('latestMerchantGrid');
    const nearestGrid = document.getElementById('nearestMerchantGrid');

    const html = merchants.map(m => `
        <div class="merchant-card glass-card" onclick="openMerchantDetail('${m.id}')">
            <img src="${m.foto || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'}" alt="${m.nama}" class="merchant-img">
            <div class="merchant-info">
                <span class="badge ${m.status.toLowerCase()}">${m.status}</span>
                <h4 class="merchant-title">${m.nama}</h4>
                <div class="merchant-meta">
                    <span>${m.kategori}</span>
                    <span>🕒 ${m.jam_buka} - ${m.jam_tutup}</span>
                </div>
            </div>
        </div>
    `).join('');

    popularGrid.innerHTML = html;
    latestGrid.innerHTML = html;
    nearestGrid.innerHTML = html;
    lucide.createIcons();
}

function initSearch(merchants) {
    const searchInput = document.getElementById('searchMerchantInput');
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        const filtered = merchants.filter(m => m.nama.toLowerCase().includes(keyword) || m.kategori.toLowerCase().includes(keyword));
        renderMerchantGrids(filtered);
    });
}

async function openMerchantDetail(merchantId) {
    try {
        const { data: merchant, error } = await supabase.from('merchants').select('*').eq('id', merchantId).single();
        if (error) throw error;

        const body = document.getElementById('merchantDetailBody');
        body.innerHTML = `
            <img src="${merchant.foto || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5'}" alt="${merchant.nama}" style="width:150px; height:150px; border-radius:50%; object-fit:cover; margin:0 auto 16px; display:block;">
            <h2 style="text-align:center; margin-bottom:8px;">${merchant.nama}</h2>
            <p style="text-align:center; color:#6B7280; margin-bottom:16px;">${merchant.alamat}</p>
            <div style="display:flex; justify-content:space-around; margin-bottom:20px; font-size:14px;">
                <span>📂 ${merchant.kategori}</span>
                <span>🕒 ${merchant.jam_buka} - ${merchant.jam_tutup}</span>
                <span class="badge ${merchant.status.toLowerCase()}">${merchant.status}</span>
            </div>
            <button class="btn-primary" onclick="openOrderModal('${merchant.id}', ${merchant.latitude}, ${merchant.longitude})">Pesan Sekarang</button>
        `;
        document.getElementById('merchantModal').classList.add('show');
    } catch (err) {
        showToast('Gagal memuat detail merchant');
    }
}

document.getElementById('closeMerchantModal').addEventListener('click', () => {
    document.getElementById('merchantModal').classList.remove('show');
});

function calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function openOrderModal(merchantId, mLat, mLng) {
    document.getElementById('merchantModal').classList.remove('show');
    document.getElementById('orderMerchantId').value = merchantId;
    document.getElementById('orderModal').classList.add('show');

    // Fetch settings for calculation
    const { data: settings } = await supabase.from('settings').select('*').single();
    
    const latInput = document.getElementById('orderLat');
    const lngInput = document.getElementById('orderLng');

    const updateCalculation = async () => {
        const uLat = parseFloat(latInput.value) || mLat;
        const uLng = parseFloat(lngInput.value) || mLng;
        const distance = calculateHaversine(mLat, mLng, uLat, uLng);
        const tarif = settings ? settings.tarif_per_km : 5000;
        const adminFee = settings ? settings.biaya_admin : 2000;
        const ongkir = Math.round(distance * tarif);
        const total = ongkir + adminFee;

        document.getElementById('summaryJarak').textContent = `${distance.toFixed(2)} km`;
        document.getElementById('summaryOngkir').textContent = `Rp ${ongkir.toLocaleString()}`;
        document.getElementById('summaryBiayaAdmin').textContent = `Rp ${adminFee.toLocaleString()}`;
        document.getElementById('summaryTotal').textContent = `Rp ${total.toLocaleString()}`;
    };

    latInput.addEventListener('input', updateCalculation);
    lngInput.addEventListener('input', updateCalculation);
    updateCalculation();
}

document.getElementById('closeOrderModal').addEventListener('click', () => {
    document.getElementById('orderModal').classList.remove('show');
});

document.getElementById('detectLocationBtn').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            document.getElementById('orderLat').value = pos.coords.latitude;
            document.getElementById('orderLng').value = pos.coords.longitude;
            showToast('Lokasi berhasil dideteksi!');
        }, () => {
            showToast('Gagal mendeteksi lokasi');
        });
    }
});

function initOrderForm() {
    const form = document.getElementById('orderForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) {
            showToast('Silakan login terlebih dahulu untuk memesan');
            return;
        }

        const merchantId = document.getElementById('orderMerchantId').value;
        const nama = document.getElementById('orderNama').value;
        const whatsapp = document.getElementById('orderWhatsapp').value;
        const alamat = document.getElementById('orderAlamat').value;
        const lat = parseFloat(document.getElementById('orderLat').value);
        const lng = parseFloat(document.getElementById('orderLng').value);
        const daftarPesanan = document.getElementById('orderDaftarPesanan').value;
        const catatan = document.getElementById('orderCatatan').value;

        const invoice = 'INV-' + Date.now();

        const { error } = await supabase.from('orders').insert([{
            invoice,
            member_id: user.id,
            merchant_id: merchantId,
            nama,
            whatsapp,
            alamat,
            latitude: lat,
            longitude: lng,
            daftar_pesanan: daftarPesanan,
            catatan,
            jarak: 2.5,
            ongkir: 12500,
            biaya_admin: 2000,
            total: 14500,
            status: 'Menunggu'
        }]);

        if (error) {
            showToast('Gagal membuat pesanan');
        } else {
            showToast('Pesanan berhasil dibuat!');
            document.getElementById('orderModal').classList.remove('show');
            form.reset();
        }
    });
}

async function checkAuthStatus() {
    const container = document.getElementById('memberAuthContainer');
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) {
        container.innerHTML = `
            <div class="glass-card" style="max-width:450px; margin:0 auto; padding:30px;">
                <h2 style="margin-bottom:20px; text-align:center;">Login Member</h2>
                <form id="loginForm">
                    <div class="form-group"><label>Email</label><input type="email" id="loginEmail" required></div>
                    <div class="form-group"><label>Password</label><input type="password" id="loginPassword" required></div>
                    <button type="submit" class="btn-primary">Login</button>
                </form>
            </div>
        `;
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showToast(error.message);
            } else {
                showToast('Login berhasil!');
                checkAuthStatus();
            }
        });
    } else {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile && profile.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        container.innerHTML = `
            <div class="glass-card" style="max-width:500px; margin:0 auto; padding:30px; text-align:center;">
                <h2>Profil Member</h2>
                <p style="margin:10px 0; color:#6B7280;">${user.email}</p>
                <button class="btn-primary" id="logoutBtn" style="margin-top:20px;">Logout</button>
            </div>
        `;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            showToast('Berhasil logout');
            checkAuthStatus();
        });
    }
}

async function loadOrderHistory() {
    const container = document.getElementById('orderContentContainer');
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; padding:40px;"><p>Silakan login di menu Member untuk melihat riwayat pesanan.</p></div>`;
        return;
    }

    const { data: orders, error } = await supabase.from('orders').select('*').eq('member_id', user.id);
    if (error || !orders.length) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; padding:40px;"><p>Belum ada riwayat pesanan.</p></div>`;
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="glass-card" style="margin-bottom:16px; padding:20px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4>${o.invoice}</h4>
                <p style="font-size:13px; color:#6B7280;">${o.daftar_pesanan}</p>
                <span class="badge buka" style="margin-top:6px; display:inline-block;">${o.status}</span>
            </div>
            <div style="text-align:right;">
                <strong>Rp ${o.total.toLocaleString()}</strong>
            </div>
        </div>
    `).join('');
}

async function initAuth() {
    // Auth initialized on tab click
}