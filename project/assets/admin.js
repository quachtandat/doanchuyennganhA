// Theme toggle
(function(){
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const saved = localStorage.getItem('adminTheme');
    if (saved === 'dark') body.classList.add('dark');
    function updateButton(){ themeToggle.textContent = body.classList.contains('dark') ? '☀️' : '🌙'; }
    updateButton();
    themeToggle.addEventListener('click', ()=>{
        body.classList.toggle('dark');
        localStorage.setItem('adminTheme', body.classList.contains('dark') ? 'dark' : 'light');
        updateButton();
    });
})();

// Fetch admin overview
async function loadOverview(){
    try{
        const res = await fetch('/api/admin/overview');
        if(!res.ok) return;
        const data = await res.json();
        document.getElementById('total-users').textContent = data.users?.toLocaleString?.() ?? data.users;
        document.getElementById('total-stories').textContent = data.stories?.toLocaleString?.() ?? data.stories;
        document.getElementById('total-chapters').textContent = data.chapters?.toLocaleString?.() ?? data.chapters;
        document.getElementById('total-reads').textContent = data.reads?.toLocaleString?.() ?? data.reads;
        const rev = Number(data.revenue || 0);
        document.getElementById('total-revenue').textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rev);
    }catch(e){ console.error('Load overview error', e); }
}

loadOverview();

// Biểu đồ lượt đọc hàng ngày
let readingChart = null;
async function loadReadingChart(){
    try{
        const res = await fetch('/api/admin/reading-stats-daily');
        if(!res.ok) return;
        const { data } = await res.json();
        
        // Loại bỏ giá trị trùng lặp liên tiếp
        const filteredData = [];
        let lastValue = null;
        data.forEach(d => {
            const val = Math.floor(d.count);
            if(val !== lastValue) {
                filteredData.push(d);
                lastValue = val;
            }
        });
        
        const labels = filteredData.map(d => d._id);
        const values = filteredData.map(d => Math.floor(d.count));
        
        const ctx = document.getElementById('readingChart');
        if(!ctx) return;
        
        if(readingChart) readingChart.destroy();
        
        readingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Lượt đọc',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Math.floor(value);
                            }
                        }
                    }
                }
            }
        });
    }catch(e){ console.error('Load reading chart error', e); }
}

// (COIN chart removed) Using Payments.amount (VNĐ) for revenue

// Biểu đồ doanh thu VND (Line chart)
let revenueVndChart = null;
async function loadRevenueVndChart(){
    try{
        const res = await fetch('/api/admin/revenue-stats-monthly');
        if(!res.ok) return;
        const { data } = await res.json();
        
        const labels = data.map(d => d._id);
        const values = data.map(d => Math.floor(d.total || 0));
        
        const ctx = document.getElementById('revenueVndChart');
        if(!ctx) return;
        
        if(revenueVndChart) revenueVndChart.destroy();
        
        revenueVndChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: values,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Math.floor(value).toLocaleString('vi-VN');
                            }
                        }
                    }
                }
            }
        });
    }catch(e){ console.error('Load revenue VND chart error', e); }
}

// Load báo cáo gần đây
async function loadRecentReports(){
    try{
        const res = await fetch('/api/admin/recent-reports');
        if(!res.ok) return;
        const { data } = await res.json();
        
        const tbody = document.getElementById('reportsBody');
        if(!tbody) return;
        
        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(r => {
            const statusBadge = r.statusClass === 'pending' 
                ? '<span style="background: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Chờ xử lý</span>'
                : '<span style="background: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Đã xử lý</span>';
            
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.chapter}</td>
                    <td style="padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.content}</td>
                    <td style="padding: 8px;">${r.reporter}</td>
                    <td style="text-align: center; padding: 8px;">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }catch(e){ console.error('Load recent reports error', e); }
}

// Load tất cả charts khi trang tải
loadReadingChart();
loadRevenueVndChart();
loadRecentReports();

// ===== NAVIGATION & SECTION MANAGEMENT =====
let currentFilter = 'pending';

// Handle sidebar navigation
document.querySelectorAll('.nav-item[data-section]').forEach(navItem => {
    navItem.addEventListener('click', () => {
        const section = navItem.getAttribute('data-section');
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
        
        // Hide all sections
        document.getElementById('dashboard-section').classList.add('hidden-section');
        document.getElementById('stories-section').classList.add('hidden-section');
        
        // Show selected section
        if (section === 'dashboard') {
            document.getElementById('dashboard-section').classList.remove('hidden-section');
        } else if (section === 'stories') {
            document.getElementById('stories-section').classList.remove('hidden-section');
            loadStories(currentFilter);
        }
    });
});

// Load stories data
async function loadStories(status = 'all') {
    try {
        const q = (document.getElementById('admin-search-input') || {}).value || '';
        const params = [];
        if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/stories${query}`);
        if (!res.ok) return;
        const { data } = await res.json();
        
        const tbody = document.getElementById('storiesTableBody');
        if (!tbody) return;
        
        document.getElementById('stories-count').textContent = data.length;
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(story => {
            const statusClass = story.status === 'published' ? 'status-approved' : (story.status === 'pending' ? 'status-pending' : 'status-rejected');
            const statusText = story.status === 'published' ? 'Đã duyệt' : (story.status === 'pending' ? 'Chờ duyệt' : 'Từ chối');
            
            // Actions: pending -> show approve + delete; published -> show reject + delete; rejected -> show approve + delete
            let actionsHtml = '';
            if (story.status === 'pending') {
                actionsHtml = `<i class="icon approve-icon" title="Duyệt">✓</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            } else if (story.status === 'published') {
                actionsHtml = `<i class="icon reject-icon" title="Từ chối">❌</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            } else { // rejected
                actionsHtml = `<i class="icon approve-icon" title="Duyệt">✓</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            }

            return `
                <tr data-id="${story.id}">
                    <td><strong>${story.title}</strong></td>
                    <td>${story.author}</td>
                    <td><span class="status-tag ${statusClass}">${statusText}</span></td>
                    <td>${story.createdAt}</td>
                    <td class="actions-cell">${actionsHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Load stories error', e);
    }
}

// Handle status filter
const statusFilterDropdown = document.getElementById('status-filter');
if (statusFilterDropdown) {
    const statusLabel = document.getElementById('status-label');
    const dropdownMenu = statusFilterDropdown.querySelector('.dropdown-menu');
    
    statusFilterDropdown.addEventListener('click', () => {
        dropdownMenu.classList.toggle('show');
    });
    
    dropdownMenu.querySelectorAll('div').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            currentFilter = value;
            statusLabel.textContent = option.textContent;
            dropdownMenu.classList.remove('show');
            loadStories(value);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!statusFilterDropdown.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });
}

// Initialize status label to match default filter
(function(){
    const statusLabel = document.getElementById('status-label');
    if (statusLabel && currentFilter === 'pending') statusLabel.textContent = 'Chờ duyệt';
})();

// Search input: trigger search on Enter, also simple debounce on input
(function(){
    const input = document.getElementById('admin-search-input');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadStories(currentFilter);
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadStories(currentFilter), 400);
    });
})();

// Action handling for stories (approve / reject / delete)
(function(){
    const tbody = document.getElementById('storiesTableBody');
    if (!tbody) return;

    let deletingId = null;
    const modal = document.getElementById('confirmModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');

    tbody.addEventListener('click', async (e) => {
        const approveEl = e.target.closest('.approve-icon');
        const rejectEl = e.target.closest('.reject-icon');
        const deleteEl = e.target.closest('.delete-icon');
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');

        if (approveEl) {
            try {
                const res = await fetch(`/api/admin/stories/${id}/approve`, { method: 'POST' });
                if (res.ok) {
                    loadStories(currentFilter);
                } else {
                    console.error('Approve failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (rejectEl) {
            try {
                const res = await fetch(`/api/admin/stories/${id}/reject`, { method: 'POST' });
                if (res.ok) {
                    loadStories(currentFilter);
                } else {
                    console.error('Reject failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (deleteEl) {
            deletingId = id;
            if (modal) modal.classList.add('show');
        }
    });

    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        deletingId = null;
        if (modal) modal.classList.remove('show');
    });

    if (confirmBtn) confirmBtn.addEventListener('click', async () => {
        if (!deletingId) return;
        try {
            const res = await fetch(`/api/admin/stories/${deletingId}`, { method: 'DELETE' });
            if (res.ok) {
                deletingId = null;
                if (modal) modal.classList.remove('show');
                loadStories(currentFilter);
            } else {
                console.error('Delete failed', await res.text());
            }
        } catch (err) { console.error(err); }
    });

    // close modal when clicking backdrop
    if (modal) modal.addEventListener('click', (ev) => {
        if (ev.target === modal) {
            deletingId = null;
            modal.classList.remove('show');
        }
    });
})();

