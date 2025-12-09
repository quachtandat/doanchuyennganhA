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

// Logout functionality (client-side clear + optional server call)
(function(){
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
        if (!confirm('Bạn có chắc muốn đăng xuất?')) return;

        // Clear client-side auth data
        try {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userData');
        } catch (e) { /* ignore */ }

        // Try server-side logout endpoint if present (non-blocking)
        try {
            await fetch('/auth/logout', { method: 'POST' });
        } catch (e) { /* endpoint may not exist; ignore */ }

        // Redirect to homepage
        window.location.href = '/';
    });
})();

// If the server redirected with ?token=..., save it so subsequent fetches can use it,
// then remove the token from the URL to avoid leaking it in referers.
(function(){
    try{
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if(t){
            try{ localStorage.setItem('accessToken', t); }catch(e){}
            params.delete('token');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? ('?' + newSearch) : '');
            history.replaceState(null, '', newUrl);
        }
    }catch(e){ /* ignore */ }
})();

// Auto-insert Authorization header for admin API fetches
(function(){
    const _fetch = window.fetch.bind(window);
    window.fetch = function(input, init){
        try{
            let url = '';
            if(typeof input === 'string') url = input;
            else if(input && input.url) url = input.url;

            if(typeof url === 'string' && url.startsWith('/api/admin')){
                init = init || {};
                init.headers = init.headers || {};
                const token = localStorage.getItem('accessToken');
                if(token){
                    if(init.headers instanceof Headers) init.headers.set('Authorization', 'Bearer ' + token);
                    else init.headers['Authorization'] = 'Bearer ' + token;
                }
            }
        }catch(e){ /* best effort */ }
        return _fetch(input, init);
    };
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
let currentPage = 1;
let currentChapterFilter = 'pending';
let currentChapterPage = 1;
let currentUserRole = 'all';
let currentUserPage = 1;
let currentReportStatus = 'pending';
let currentReportPage = 1;
let currentAuthorRequestPage = 1;
const PAGE_SIZE = 10;

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
        document.getElementById('chapters-section').classList.add('hidden-section');
        document.getElementById('users-section').classList.add('hidden-section');
        document.getElementById('reports-section').classList.add('hidden-section');
        document.getElementById('author-requests-section').classList.add('hidden-section');
        document.getElementById('author-requests-section').classList.add('hidden-section');
        
        // Show selected section
        if (section === 'dashboard') {
            document.getElementById('dashboard-section').classList.remove('hidden-section');
        } else if (section === 'stories') {
            document.getElementById('stories-section').classList.remove('hidden-section');
            loadStories(currentFilter, currentPage);
        } else if (section === 'chapters') {
            document.getElementById('chapters-section').classList.remove('hidden-section');
            loadChapters(currentChapterFilter, currentChapterPage);
        } else if (section === 'users') {
            document.getElementById('users-section').classList.remove('hidden-section');
            loadUsers(currentUserRole, currentUserPage);
        } else if (section === 'reports') {
            document.getElementById('reports-section').classList.remove('hidden-section');
            loadReports(currentReportStatus, currentReportPage);
        } else if (section === 'author-requests') {
            document.getElementById('author-requests-section').classList.remove('hidden-section');
            loadAuthorRequests(currentAuthorRequestPage);
        } else if (section === 'author-requests') {
            document.getElementById('author-requests-section').classList.remove('hidden-section');
            loadAuthorRequests(currentAuthorRequestPage);
        }
    });
});

// Load stories data
async function loadStories(status = 'all', page = 1) {
    try {
        const q = (document.getElementById('admin-search-input') || {}).value || '';
        const params = [];
        if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`page=${page}`);
        params.push(`pageSize=${PAGE_SIZE}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/stories${query}`);
        if (!res.ok) return;
        const { data, total } = await res.json();

        const tbody = document.getElementById('storiesTableBody');
        if (!tbody) return;

        document.getElementById('stories-count').textContent = total;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            document.getElementById('stories-pagination').style.display = 'none';
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

        // Pagination logic
        const paginationBar = document.getElementById('stories-pagination');
        if (!paginationBar) return;
        if (total <= PAGE_SIZE) {
            paginationBar.style.display = 'none';
            return;
        }
        paginationBar.style.display = 'block';
        const totalPages = Math.ceil(total / PAGE_SIZE);
        let html = '';
        if (page > 1) {
            html += `<button class="pagination-btn" data-page="${page-1}">« Trước</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="pagination-btn" data-page="${page+1}">Tiếp »</button>`;
        }
        paginationBar.innerHTML = html;

        // Attach click handlers
        paginationBar.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(btn.getAttribute('data-page'), 10);
                if (!isNaN(newPage) && newPage !== page) {
                    currentPage = newPage;
                    loadStories(currentFilter, currentPage);
                }
            });
        });
    } catch (e) {
        console.error('Load stories error', e);
    }
}

// Load chapters data
async function loadChapters(status = 'all', page = 1) {
    try {
        const q = (document.getElementById('admin-chapter-search-input') || {}).value || '';
        const params = [];
        if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`page=${page}`);
        params.push(`pageSize=${PAGE_SIZE}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/chapters${query}`);
        if (!res.ok) return;
        const { data, total } = await res.json();

        const tbody = document.getElementById('chaptersTableBody');
        if (!tbody) return;

        document.getElementById('chapters-count').textContent = total;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            document.getElementById('chapters-pagination').style.display = 'none';
            return;
        }

        tbody.innerHTML = data.map(chapter => {
            const statusClass = chapter.status === 'published' ? 'status-approved' : (chapter.status === 'pending' ? 'status-pending' : 'status-rejected');
            const statusText = chapter.status === 'published' ? 'Đã duyệt' : (chapter.status === 'pending' ? 'Chờ duyệt' : 'Từ chối');

            // Actions: pending -> show approve + delete; published -> show reject + delete; rejected -> show approve + delete
            let actionsHtml = '';
            if (chapter.status === 'pending') {
                actionsHtml = `<i class="icon approve-icon" title="Duyệt">✓</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            } else if (chapter.status === 'published') {
                actionsHtml = `<i class="icon reject-icon" title="Từ chối">❌</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            } else { // rejected
                actionsHtml = `<i class="icon approve-icon" title="Duyệt">✓</i> <i class="icon delete-icon" title="Xóa">🗑️</i>`;
            }

            return `
                <tr data-id="${chapter.id}">
                    <td><strong>${chapter.title}</strong></td>
                    <td>${chapter.story}</td>
                    <td>${chapter.author}</td>
                    <td><span class="status-tag ${statusClass}">${statusText}</span></td>
                    <td>${chapter.createdAt}</td>
                    <td>${chapter.updatedAt}</td>
                    <td class="actions-cell">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        // Pagination logic
        const paginationBar = document.getElementById('chapters-pagination');
        if (!paginationBar) return;
        if (total <= PAGE_SIZE) {
            paginationBar.style.display = 'none';
            return;
        }
        paginationBar.style.display = 'block';
        const totalPages = Math.ceil(total / PAGE_SIZE);
        let html = '';
        if (page > 1) {
            html += `<button class="pagination-btn" data-page="${page-1}">« Trước</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="pagination-btn" data-page="${page+1}">Tiếp »</button>`;
        }
        paginationBar.innerHTML = html;

        // Attach click handlers
        paginationBar.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(btn.getAttribute('data-page'), 10);
                if (!isNaN(newPage) && newPage !== page) {
                    currentChapterPage = newPage;
                    loadChapters(currentChapterFilter, currentChapterPage);
                }
            });
        });
    } catch (e) {
        console.error('Load chapters error', e);
    }
}

// Load users data
async function loadUsers(role = 'all', page = 1) {
    try {
        const q = (document.getElementById('admin-user-search-input') || {}).value || '';
        const params = [];
        if (role && role !== 'all') params.push(`role=${encodeURIComponent(role)}`);
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`page=${page}`);
        params.push(`pageSize=${PAGE_SIZE}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/users${query}`);
        if (!res.ok) return;
        const { data, total } = await res.json();

        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        document.getElementById('users-count').textContent = total;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            document.getElementById('users-pagination').style.display = 'none';
            return;
        }

        tbody.innerHTML = data.map(user => {
            const statusBadge = user.isLocked 
                ? '<span class="status-tag" style="background: #fee2e2; color: #991b1b;">Bị khóa</span>'
                : '<span class="status-tag" style="background: #d1fae5; color: #065f46;">Hoạt động</span>';
            
            const roleText = user.role === 'author' ? 'Tác giả' : (user.role === 'admin' ? 'Quản trị viên' : 'Độc giả');
            const isAuthor = user.role === 'author';

            // Actions: lock/unlock + demote (if author)
            let actionsHtml = '';
            if (user.isLocked) {
                actionsHtml = `<i class="icon unlock-icon" title="Mở khóa" data-user-id="${user.id}">🔓</i>`;
            } else {
                actionsHtml = `<i class="icon lock-icon" title="Khóa" data-user-id="${user.id}">🔒</i>`;
            }
            if (isAuthor) {
                actionsHtml += ` <i class="icon demote-icon" title="Loại" data-user-id="${user.id}">⬇️</i>`;
            }

            return `
                <tr data-id="${user.id}">
                    <td><strong>${user.name}</strong></td>
                    <td>${user.email}</td>
                    <td>${roleText}</td>
                    <td>${statusBadge}</td>
                    <td>${user.createdAt}</td>
                    <td class="actions-cell">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        // Pagination logic
        const paginationBar = document.getElementById('users-pagination');
        if (!paginationBar) return;
        if (total <= PAGE_SIZE) {
            paginationBar.style.display = 'none';
            return;
        }
        paginationBar.style.display = 'block';
        const totalPages = Math.ceil(total / PAGE_SIZE);
        let html = '';
        if (page > 1) {
            html += `<button class="pagination-btn" data-page="${page-1}">« Trước</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="pagination-btn" data-page="${page+1}">Tiếp »</button>`;
        }
        paginationBar.innerHTML = html;

        // Attach click handlers
        paginationBar.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(btn.getAttribute('data-page'), 10);
                if (!isNaN(newPage) && newPage !== page) {
                    currentUserPage = newPage;
                    loadUsers(currentUserRole, currentUserPage);
                }
            });
        });
    } catch (e) {
        console.error('Load users error', e);
    }
}

// Load reports with status filtering and search
async function loadReports(status = 'pending', page = 1) {
    try {
        const q = (document.getElementById('admin-report-search-input') || {}).value || '';
        const params = [];
        if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`page=${page}`);
        params.push(`pageSize=${PAGE_SIZE}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/reports${query}`);
        if (!res.ok) return;
        const { data, total } = await res.json();

        const tbody = document.getElementById('reportsTableBody');
        if (!tbody) return;

        document.getElementById('reports-count').textContent = total;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            document.getElementById('reports-pagination').style.display = 'none';
            return;
        }

        tbody.innerHTML = data.map(report => {
            const statusBadge = report.status === 'pending'
                ? '<span class="status-tag" style="background: #dbeafe; color: #1e40af;">Chờ xử lý</span>'
                : '<span class="status-tag" style="background: #dcfce7; color: #15803d;">Đã xử lý</span>';
            
            const actionIcon = report.status === 'pending'
                ? `<i class="icon approve-icon" title="Đánh dấu đã xử lý" data-report-id="${report.id}">✓</i>`
                : `<i class="icon pending-icon" title="Đánh dấu chờ xử lý" data-report-id="${report.id}">↻</i>`;

            return `
                <tr data-id="${report.id}">
                    <td>${report.story || 'N/A'}</td>
                    <td>${report.chapter || 'N/A'}</td>
                    <td>${report.reporter || 'N/A'}</td>
                    <td>${report.reason}</td>
                    <td>${report.createdAt}</td>
                    <td>${statusBadge}</td>
                    <td class="actions-cell">${actionIcon}</td>
                </tr>
            `;
        }).join('');

        // Pagination logic
        const paginationBar = document.getElementById('reports-pagination');
        if (!paginationBar) return;
        if (total <= PAGE_SIZE) {
            paginationBar.style.display = 'none';
            return;
        }
        paginationBar.style.display = 'block';
        const totalPages = Math.ceil(total / PAGE_SIZE);
        let html = '';
        if (page > 1) {
            html += `<button class="pagination-btn" data-page="${page-1}">« Trước</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="pagination-btn" data-page="${page+1}">Tiếp »</button>`;
        }
        paginationBar.innerHTML = html;

        // Attach click handlers
        paginationBar.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(btn.getAttribute('data-page'), 10);
                if (!isNaN(newPage) && newPage !== page) {
                    currentReportPage = newPage;
                    loadReports(currentReportStatus, currentReportPage);
                }
            });
        });
    } catch (e) {
        console.error('Load reports error', e);
    }
}

// Load author requests (pending only)
async function loadAuthorRequests(page = 1) {
    try {
        const q = (document.getElementById('admin-author-request-search-input') || {}).value || '';
        const params = [];
        if (q && q.trim() !== '') params.push(`q=${encodeURIComponent(q.trim())}`);
        params.push(`page=${page}`);
        params.push(`pageSize=${PAGE_SIZE}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const res = await fetch(`/api/admin/author-requests${query}`);
        if (!res.ok) return;
        const { data, total } = await res.json();

        const tbody = document.getElementById('authorRequestsTableBody');
        if (!tbody) return;

        document.getElementById('author-requests-count').textContent = total;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Không có dữ liệu</td></tr>';
            document.getElementById('author-requests-pagination').style.display = 'none';
            return;
        }

        tbody.innerHTML = data.map(request => {
            return `
                <tr data-id="${request.id}">
                    <td>${request.userName || 'N/A'}</td>
                    <td>${request.userEmail || 'N/A'}</td>
                    <td>${request.message || 'N/A'}</td>
                    <td>${request.createdAt}</td>
                    <td class="actions-cell">
                        <i class="icon approve-icon" title="Chấp nhận" data-request-id="${request.id}">✓</i>
                        <i class="icon reject-icon" title="Từ chối" data-request-id="${request.id}">✕</i>
                    </td>
                </tr>
            `;
        }).join('');

        // Pagination logic
        const paginationBar = document.getElementById('author-requests-pagination');
        if (!paginationBar) return;
        if (total <= PAGE_SIZE) {
            paginationBar.style.display = 'none';
            return;
        }
        paginationBar.style.display = 'block';
        const totalPages = Math.ceil(total / PAGE_SIZE);
        let html = '';
        if (page > 1) {
            html += `<button class="pagination-btn" data-page="${page-1}">« Trước</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="pagination-btn" data-page="${page+1}">Tiếp »</button>`;
        }
        paginationBar.innerHTML = html;

        // Attach click handlers
        paginationBar.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(btn.getAttribute('data-page'), 10);
                if (!isNaN(newPage) && newPage !== page) {
                    currentAuthorRequestPage = newPage;
                    loadAuthorRequests(currentAuthorRequestPage);
                }
            });
        });
    } catch (e) {
        console.error('Load author requests error', e);
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
            currentPage = 1;
            loadStories(value, currentPage);
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
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            loadStories(currentFilter, currentPage);
        }, 400);
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
                    loadStories(currentFilter, currentPage);
                } else {
                    console.error('Approve failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (rejectEl) {
            try {
                const res = await fetch(`/api/admin/stories/${id}/reject`, { method: 'POST' });
                if (res.ok) {
                    loadStories(currentFilter, currentPage);
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
                loadStories(currentFilter, currentPage);
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

// Chapter status filter
const chapterFilterDropdown = document.getElementById('chapter-status-filter');
if (chapterFilterDropdown) {
    const chapterStatusLabel = document.getElementById('chapter-status-label');
    const chapterDropdownMenu = chapterFilterDropdown.querySelector('.dropdown-menu');
    
    chapterFilterDropdown.addEventListener('click', () => {
        chapterDropdownMenu.classList.toggle('show');
    });
    
    chapterDropdownMenu.querySelectorAll('div').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            currentChapterFilter = value;
            chapterStatusLabel.textContent = option.textContent;
            chapterDropdownMenu.classList.remove('show');
            currentChapterPage = 1;
            loadChapters(value, currentChapterPage);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!chapterFilterDropdown.contains(e.target)) {
            chapterDropdownMenu.classList.remove('show');
        }
    });
}

// Initialize chapter status label to match default filter
(function(){
    const chapterStatusLabel = document.getElementById('chapter-status-label');
    if (chapterStatusLabel && currentChapterFilter === 'pending') chapterStatusLabel.textContent = 'Chờ duyệt';
})();

// Chapter search input: trigger search on Enter, also simple debounce on input
(function(){
    const input = document.getElementById('admin-chapter-search-input');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            currentChapterPage = 1;
            loadChapters(currentChapterFilter, currentChapterPage);
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentChapterPage = 1;
            loadChapters(currentChapterFilter, currentChapterPage);
        }, 400);
    });
})();

// Chapter action handling (approve / reject / delete)
(function(){
    const tbody = document.getElementById('chaptersTableBody');
    if (!tbody) return;

    let deletingId = null;
    const modal = document.getElementById('confirmModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    let isChapterDelete = false;

    tbody.addEventListener('click', async (e) => {
        const approveEl = e.target.closest('.approve-icon');
        const rejectEl = e.target.closest('.reject-icon');
        const deleteEl = e.target.closest('.delete-icon');
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.getAttribute('data-id');

        if (approveEl) {
            try {
                const res = await fetch(`/api/admin/chapters/${id}/approve`, { method: 'POST' });
                if (res.ok) {
                    loadChapters(currentChapterFilter, currentChapterPage);
                } else {
                    console.error('Approve failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (rejectEl) {
            try {
                const res = await fetch(`/api/admin/chapters/${id}/reject`, { method: 'POST' });
                if (res.ok) {
                    loadChapters(currentChapterFilter, currentChapterPage);
                } else {
                    console.error('Reject failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (deleteEl) {
            deletingId = id;
            isChapterDelete = true;
            if (modal) modal.classList.add('show');
        }
    });

    // Shared modal handlers
    if (cancelBtn && !cancelBtn.dataset.listenerAdded) {
        cancelBtn.addEventListener('click', () => {
            deletingId = null;
            isChapterDelete = false;
            if (modal) modal.classList.remove('show');
        });
        cancelBtn.dataset.listenerAdded = 'true';
    }

    if (confirmBtn && !confirmBtn.dataset.listenerAdded) {
        confirmBtn.addEventListener('click', async () => {
            if (!deletingId) return;
            try {
                const endpoint = isChapterDelete ? `/api/admin/chapters/${deletingId}` : `/api/admin/stories/${deletingId}`;
                const res = await fetch(endpoint, { method: 'DELETE' });
                if (res.ok) {
                    deletingId = null;
                    if (modal) modal.classList.remove('show');
                    if (isChapterDelete) {
                        loadChapters(currentChapterFilter, currentChapterPage);
                    } else {
                        loadStories(currentFilter, currentPage);
                    }
                } else {
                    console.error('Delete failed', await res.text());
                }
            } catch (err) { console.error(err); }
        });
        confirmBtn.dataset.listenerAdded = 'true';
    }

    if (modal && !modal.dataset.listenerAdded) {
        modal.addEventListener('click', (ev) => {
            if (ev.target === modal) {
                deletingId = null;
                isChapterDelete = false;
                modal.classList.remove('show');
            }
        });
        modal.dataset.listenerAdded = 'true';
    }
})();

// User role filter
const userRoleFilterDropdown = document.getElementById('user-role-filter');
if (userRoleFilterDropdown) {
    const userRoleLabel = document.getElementById('user-role-label');
    const userRoleDropdownMenu = userRoleFilterDropdown.querySelector('.dropdown-menu');
    
    userRoleFilterDropdown.addEventListener('click', () => {
        userRoleDropdownMenu.classList.toggle('show');
    });
    
    userRoleDropdownMenu.querySelectorAll('div').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            currentUserRole = value;
            userRoleLabel.textContent = option.textContent;
            userRoleDropdownMenu.classList.remove('show');
            currentUserPage = 1;
            loadUsers(value, currentUserPage);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userRoleFilterDropdown.contains(e.target)) {
            userRoleDropdownMenu.classList.remove('show');
        }
    });
}

// Initialize user role label to match default filter
(function(){
    const userRoleLabel = document.getElementById('user-role-label');
    if (userRoleLabel && currentUserRole === 'all') userRoleLabel.textContent = 'Tất cả vai trò';
})();

// User search input: trigger search on Enter, also simple debounce on input
(function(){
    const input = document.getElementById('admin-user-search-input');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            currentUserPage = 1;
            loadUsers(currentUserRole, currentUserPage);
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentUserPage = 1;
            loadUsers(currentUserRole, currentUserPage);
        }, 400);
    });
})();

// User action handling (lock / unlock / demote)
(function(){
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', async (e) => {
        const lockEl = e.target.closest('.lock-icon');
        const unlockEl = e.target.closest('.unlock-icon');
        const demoteEl = e.target.closest('.demote-icon');
        
        const userId = lockEl?.getAttribute('data-user-id') || 
                       unlockEl?.getAttribute('data-user-id') || 
                       demoteEl?.getAttribute('data-user-id');
        if (!userId) return;

        if (lockEl) {
            try {
                const res = await fetch(`/api/admin/users/${userId}/lock`, { method: 'POST' });
                if (res.ok) {
                    loadUsers(currentUserRole, currentUserPage);
                } else {
                    console.error('Lock failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (unlockEl) {
            try {
                const res = await fetch(`/api/admin/users/${userId}/unlock`, { method: 'POST' });
                if (res.ok) {
                    loadUsers(currentUserRole, currentUserPage);
                } else {
                    console.error('Unlock failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (demoteEl) {
            if (confirm('Bạn có chắc muốn loại người dùng này khỏi vai trò tác giả?')) {
                try {
                    const res = await fetch(`/api/admin/users/${userId}/demote`, { method: 'POST' });
                    if (res.ok) {
                        loadUsers(currentUserRole, currentUserPage);
                    } else {
                        console.error('Demote failed', await res.text());
                    }
                } catch (err) { console.error(err); }
            }
        }
    });
})();

// Report status filter
const reportStatusFilterDropdown = document.getElementById('report-status-filter');
if (reportStatusFilterDropdown) {
    const reportStatusLabel = document.getElementById('report-status-label');
    const reportStatusDropdownMenu = reportStatusFilterDropdown.querySelector('.dropdown-menu');
    
    reportStatusFilterDropdown.addEventListener('click', () => {
        reportStatusDropdownMenu.classList.toggle('show');
    });
    
    reportStatusDropdownMenu.querySelectorAll('div').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            currentReportStatus = value;
            reportStatusLabel.textContent = option.textContent;
            reportStatusDropdownMenu.classList.remove('show');
            currentReportPage = 1;
            loadReports(value, currentReportPage);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!reportStatusFilterDropdown.contains(e.target)) {
            reportStatusDropdownMenu.classList.remove('show');
        }
    });
}

// Initialize report status label to match default filter
(function(){
    const reportStatusLabel = document.getElementById('report-status-label');
    if (reportStatusLabel && currentReportStatus === 'pending') reportStatusLabel.textContent = 'Chờ xử lý';
})();

// Report search input: trigger search on Enter, also simple debounce on input
(function(){
    const input = document.getElementById('admin-report-search-input');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            currentReportPage = 1;
            loadReports(currentReportStatus, currentReportPage);
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentReportPage = 1;
            loadReports(currentReportStatus, currentReportPage);
        }, 400);
    });
})();

// Report action handling (resolve / pending)
(function(){
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', async (e) => {
        const resolveEl = e.target.closest('.approve-icon');
        const pendingEl = e.target.closest('.pending-icon');
        
        const reportId = resolveEl?.getAttribute('data-report-id') || 
                        pendingEl?.getAttribute('data-report-id');
        if (!reportId) return;

        if (resolveEl) {
            try {
                const res = await fetch(`/api/admin/reports/${reportId}/resolve`, { method: 'POST' });
                if (res.ok) {
                    loadReports(currentReportStatus, currentReportPage);
                } else {
                    console.error('Resolve failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (pendingEl) {
            try {
                const res = await fetch(`/api/admin/reports/${reportId}/pending`, { method: 'POST' });
                if (res.ok) {
                    loadReports(currentReportStatus, currentReportPage);
                } else {
                    console.error('Pending failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }
    });
})();

// Author request search input: trigger search on Enter, also simple debounce on input
(function(){
    const input = document.getElementById('admin-author-request-search-input');
    if (!input) return;
    let debounceTimer = null;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            currentAuthorRequestPage = 1;
            loadAuthorRequests(currentAuthorRequestPage);
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentAuthorRequestPage = 1;
            loadAuthorRequests(currentAuthorRequestPage);
        }, 400);
    });
})();

// Author request action handling (approve / reject)
(function(){
    const tbody = document.getElementById('authorRequestsTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', async (e) => {
        const approveEl = e.target.closest('.approve-icon');
        const rejectEl = e.target.closest('.reject-icon');
        
        const requestId = approveEl?.getAttribute('data-request-id') || 
                         rejectEl?.getAttribute('data-request-id');
        if (!requestId) return;

        if (approveEl) {
            try {
                const res = await fetch(`/api/admin/author-requests/${requestId}/approve`, { method: 'POST' });
                if (res.ok) {
                    loadAuthorRequests(currentAuthorRequestPage);
                } else {
                    console.error('Approve failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }

        if (rejectEl) {
            try {
                const res = await fetch(`/api/admin/author-requests/${requestId}/reject`, { method: 'POST' });
                if (res.ok) {
                    loadAuthorRequests(currentAuthorRequestPage);
                } else {
                    console.error('Reject failed', await res.text());
                }
            } catch (err) { console.error(err); }
        }
    });
})();

// Ensure admin API requests include Authorization header from localStorage
(function(){
    try {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init = {}) => {
            try {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                if (typeof url === 'string' && url.startsWith('/api/admin')) {
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                        init.headers = Object.assign({}, init.headers || {}, { 'Authorization': `Bearer ${token}` });
                    }
                }
            } catch (e) {
                // ignore
            }
            return originalFetch(input, init);
        };
    } catch (e) {
        // ignore if fetch cannot be wrapped
    }
})();