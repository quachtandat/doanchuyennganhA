// Helper function to escape HTML
function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, function(s){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]);
    });
}

// Pagination configuration
const ITEMS_PER_PAGE = 10;
let storiesData = [];
let storiesCurrentPage = 1;
let chaptersData = [];
let chaptersCurrentPage = 1;
let chaptersFilteredData = [];
let isChaptersFiltering = false;
let commentsData = [];
let commentsCurrentPage = 1;
let commentsFilteredData = [];
let isCommentsFiltering = false;

// Get authorization token from localStorage
function getAuthToken() {
    return localStorage.getItem('accessToken');
}

// Get common fetch headers with auth
function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Format date to DD/MM/YYYY
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Get status badge class based on status value
function getStatusClass(status) {
    switch(status) {
        case 'published': return 'status status-published';
        case 'pending': return 'status status-pending';
        case 'rejected': return 'status status-rejected';
        default: return 'status status-pending';
    }
}

// Get status display text based on status value
function getStatusText(status) {
    switch(status) {
        case 'published': return 'Đã đăng';
        case 'pending': return 'Chưa đăng';
        case 'rejected': return 'Bị từ chối';
        default: return 'Chưa đăng';
    }
}

// Load top stories and render table
async function loadTopStories(){
    try{
        const headers = getAuthHeaders();
        const res = await fetch('/author/top-stories?limit=6', { headers });
        const tbody = document.getElementById('topStoriesBody');
        if(!tbody) {
            console.warn('topStoriesBody element not found');
            return;
        }
        if(!res.ok){
            console.error('Top stories fetch failed:', res.status);
            tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center; color:#999;">Không thể tải dữ liệu</td></tr>';
            return;
        }
        const { data } = await res.json();
        if(!data || data.length === 0){
            tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center; color:#999;">Không có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(s => `
            <tr>
                <td style="max-width:420px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.title)}</td>
                <td>${(s.reads||0).toLocaleString()}</td>
                <td>${(s.chapters||0).toLocaleString()}</td>
                <td>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s.revenueVnd||0)}</td>
            </tr>
        `).join('');
        console.log('Top stories loaded:', data.length);
    }catch(e){ 
        console.error('Load top stories error', e); 
        const tbody = document.getElementById('topStoriesBody');
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center; color:#999;">Lỗi khi tải dữ liệu</td></tr>';
    }
}

// Load author overview and charts
async function loadAuthorOverview(){
    try{
        const headers = getAuthHeaders();

        // Overview
        const ovRes = await fetch('/author/overview', { headers });
        if(ovRes.ok){
            const ov = await ovRes.json();
            document.getElementById('total-stories').textContent = (ov.stories || 0).toLocaleString();
            document.getElementById('total-chapters').textContent = (ov.chapters || 0).toLocaleString();
            document.getElementById('total-reads').textContent = (ov.reads || 0).toLocaleString();
            document.getElementById('total-revenue').textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(ov.revenueVnd || 0);
        }

        // Reading chart (last 30 days)
        const rRes = await fetch('/author/reading-stats-daily', { headers });
        if(rRes.ok){
            const { data } = await rRes.json();
            const labels = data.map(d => d._id);
            const values = data.map(d => d.count);
            const ctx = document.getElementById('readingChart');
            if(ctx){
                new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets: [{ label: 'Lượt đọc', data: values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill:true }] },
                    options: { responsive:true, maintainAspectRatio:false }
                });
            }
        }

        // Revenue chart (monthly, last 12 months)
        const revRes = await fetch('/author/revenue-stats-monthly', { headers });
        if(revRes.ok){
            const { data } = await revRes.json();
            const labels = data.map(d => d._id);
            const values = data.map(d => d.total || 0);
            const ctx2 = document.getElementById('revenueChart');
            if(ctx2){
                new Chart(ctx2, {
                    type: 'bar',
                    data: { labels, datasets: [{ label: 'Doanh thu (VNĐ)', data: values, backgroundColor: '#f59e0b' }] },
                    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback: v => Number(v).toLocaleString('vi-VN')}}} }
                });
            }
        }
    }catch(e){ 
        console.error('Author overview load error', e); 
    }
}

// Render paginated table for stories
function renderStoriesTable(page = 1) {
    storiesCurrentPage = page;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = storiesData.slice(start, end);

    const tbody = document.getElementById('storiesTableBody');
    if (!tbody) return;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Không có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = pageData.map(story => {
        const categoryStr = Array.isArray(story.category) ? story.category.join(', ') : (story.category || 'N/A');
        const reads = (story.readCount || 0).toLocaleString();
        const chapters = story.chapterCount || 0;
        const createdDate = formatDate(story.createdAt);
        const statusClass = getStatusClass(story.status);
        const statusText = getStatusText(story.status);

        return `
            <tr>
                <td>${escapeHtml(story.title)}</td>
                <td>${escapeHtml(categoryStr)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${chapters}</td>
                <td>${reads}</td>
                <td>${createdDate}</td>
                <td class="actions">
                    <i class="fas fa-edit action-icon edit" data-id="${story._id}" title="Chỉnh sửa"></i>
                    <i class="fas fa-trash-alt action-icon delete" data-id="${story._id}" title="Xóa"></i>
                </td>
            </tr>
        `;
    }).join('');

    attachStoryActions();
    renderPaginationStories();
}

// Render pagination controls for stories
function renderPaginationStories() {
    const paginationContainer = document.getElementById('storiesPagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(storiesData.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    let html = '';

    html += `<button onclick="renderStoriesTable(${storiesCurrentPage - 1})" ${storiesCurrentPage === 1 ? 'disabled' : ''}>← Trước</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button onclick="renderStoriesTable(${i})" class="${i === storiesCurrentPage ? 'active' : ''}">${i}</button>`;
    }

    html += `<button onclick="renderStoriesTable(${storiesCurrentPage + 1})" ${storiesCurrentPage === totalPages ? 'disabled' : ''}>Sau →</button>`;

    html += `<span class="page-info">${storiesCurrentPage} / ${totalPages}</span>`;

    paginationContainer.innerHTML = html;
}

// Load author stories and populate table
async function loadAuthorStories() {
    try {
        const headers = getAuthHeaders();
        const res = await fetch('/author/stories?sort=createdAt&order=desc', { headers });
        
        if (!res.ok) {
            const tbody = document.getElementById('storiesTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Không thể tải dữ liệu</td></tr>';
            return;
        }

        const result = await res.json();
        storiesData = result.data || [];

        if (storiesData.length === 0) {
            const tbody = document.getElementById('storiesTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Bạn chưa tạo truyện nào</td></tr>';
            const paginationContainer = document.getElementById('storiesPagination');
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        storiesCurrentPage = 1;
        renderStoriesTable(1);
    } catch (e) {
        console.error('Load author stories error', e);
        const tbody = document.getElementById('storiesTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Lỗi khi tải dữ liệu</td></tr>';
    }
}

// Attach event listeners to edit and delete icons
function attachStoryActions() {
    document.querySelectorAll('.actions .edit').forEach(icon => {
        icon.addEventListener('click', async () => {
            const storyId = icon.getAttribute('data-id');
            await openStoryModal(storyId);
        });
    });

    document.querySelectorAll('.actions .delete').forEach(icon => {
        icon.addEventListener('click', async () => {
            const storyId = icon.getAttribute('data-id');
            if (confirm('Bạn chắc chắn muốn xóa truyện này?')) {
                await deleteStory(storyId);
            }
        });
    });
}

// Open story modal for create or edit
async function openStoryModal(storyId = null) {
    const modal = document.getElementById('storyModal');
    const modalTitle = document.getElementById('storyModalTitle');
    const storyIdInput = document.getElementById('storyId');
    
    // Clear form
    document.getElementById('storyName').value = '';
    document.getElementById('storySlug').value = '';
    document.getElementById('storyCategory').value = '';
    document.getElementById('storyDescription').value = '';
    document.getElementById('storyCoverUrl').value = '';

    if (storyId) {
        // Edit mode
        modalTitle.textContent = 'Chỉnh sửa truyện';
        storyIdInput.value = storyId;

        try {
            const headers = getAuthHeaders();
            const res = await fetch(`/api/stories/${storyId}`, { headers });
            if (res.ok) {
                const story = await res.json();
                document.getElementById('storyName').value = story.title || '';
                document.getElementById('storySlug').value = story.slug || '';
                document.getElementById('storyCategory').value = Array.isArray(story.category) ? story.category.join(', ') : (story.category || '');
                document.getElementById('storyDescription').value = story.description || '';
                document.getElementById('storyCoverUrl').value = story.coverUrl || '';
            }
        } catch (e) {
            console.error('Error loading story', e);
        }
    } else {
        // Create mode
        modalTitle.textContent = 'Tạo truyện mới';
        storyIdInput.value = '';
    }

    modal.style.display = 'flex';
}

// Save story (create or update)
async function saveStory() {
    const storyId = document.getElementById('storyId').value;
    const title = document.getElementById('storyName').value.trim();
    const slug = document.getElementById('storySlug').value.trim();
    const categoryStr = document.getElementById('storyCategory').value.trim();
    const description = document.getElementById('storyDescription').value.trim();
    const coverUrl = document.getElementById('storyCoverUrl').value.trim();

    if (!title || !slug) {
        alert('Vui lòng điền tên và slug truyện');
        return;
    }

    const category = categoryStr ? categoryStr.split(',').map(c => c.trim()) : [];

    const payload = {
        title,
        slug,
        category,
        description,
        coverUrl,
        status: 'pending'
    };

    try {
        const headers = {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
        };

        const url = storyId ? `/author/stories/${storyId}` : '/author/stories';
        const method = storyId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(storyId ? 'Cập nhật truyện thành công!' : 'Tạo truyện thành công!');
            document.getElementById('storyModal').style.display = 'none';
            loadAuthorStories();
        } else {
            const error = await res.json();
            alert('Lỗi: ' + (error.message || 'Không thành công'));
        }
    } catch (e) {
        console.error('Error saving story', e);
        alert('Lỗi: ' + e.message);
    }
}

// Delete story
async function deleteStory(storyId) {
    try {
        const headers = getAuthHeaders();
        const res = await fetch(`/author/stories/${storyId}`, {
            method: 'DELETE',
            headers
        });

        if (res.ok) {
            alert('Xóa truyện thành công!');
            loadAuthorStories();
        } else {
            alert('Lỗi: Không thể xóa truyện');
        }
    } catch (e) {
        console.error('Error deleting story', e);
        alert('Lỗi: ' + e.message);
    }
}

// Tab switching functionality
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');

    if (tabName === 'stories') {
        loadAuthorStories();
    }
}

// ==================== CHAPTERS MANAGEMENT ====================

async function loadAuthorChapters() {
    try {
        const headers = getAuthHeaders();
        const res = await fetch('/author/chapters?sort=createdAt&order=desc', { headers });

        if (!res.ok) {
            const tbody = document.getElementById('chaptersTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Không thể tải dữ liệu</td></tr>';
            return;
        }

        const result = await res.json();
        chaptersData = result.data || [];
        chaptersFilteredData = [];
        isChaptersFiltering = false;

        if (chaptersData.length === 0) {
            const tbody = document.getElementById('chaptersTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Bạn chưa tạo chương nào</td></tr>';
            populateStoryFilter([]);
            const paginationContainer = document.getElementById('chaptersPagination');
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        const uniqueStories = [...new Set(chaptersData.map(ch => JSON.stringify({ id: ch.storyId, title: ch.storyTitle })))].map(s => JSON.parse(s));
        populateStoryFilter(uniqueStories);

        chaptersCurrentPage = 1;
        renderChaptersTable(1);
    } catch (e) {
        console.error('Load chapters error', e);
        const tbody = document.getElementById('chaptersTableBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Lỗi khi tải dữ liệu</td></tr>';
    }
}

function renderChaptersTable(page = 1) {
    chaptersCurrentPage = page;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    
    const dataSource = isChaptersFiltering ? chaptersFilteredData : chaptersData;
    const pageData = dataSource.slice(start, end);

    const tbody = document.getElementById('chaptersTableBody');
    if (!tbody) return;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center; color:#999;">Không có dữ liệu</td></tr>';
        return;
    }

    tbody.innerHTML = pageData.map(chapter => {
        const storyTitle = chapter.storyTitle || 'N/A';
        const number = chapter.number || '—';
        const title = escapeHtml(chapter.title || 'Không có tiêu đề');
        const reads = (chapter.readCount || 0).toLocaleString();
        const status = chapter.status || 'draft';
        const statusClass = getChapterStatusClass(status);
        const statusText = getChapterStatusText(status);
        const createdDate = formatDate(chapter.createdAt);

        return `
            <tr data-story-id="${chapter.storyId}">
                <td>${escapeHtml(storyTitle)}</td>
                <td>#${number}</td>
                <td>${title}</td>
                <td>${reads}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${createdDate}</td>
                <td class="actions">
                    <i class="fas fa-edit action-icon edit-chapter" data-id="${chapter._id}" title="Chỉnh sửa"></i>
                    <i class="fas fa-trash-alt action-icon delete-chapter" data-id="${chapter._id}" title="Xóa"></i>
                </td>
            </tr>
        `;
    }).join('');

    attachChapterActions();
    renderPaginationChapters();
}

function renderPaginationChapters() {
    const paginationContainer = document.getElementById('chaptersPagination');
    if (!paginationContainer) return;

    const dataSource = isChaptersFiltering ? chaptersFilteredData : chaptersData;
    const totalPages = Math.ceil(dataSource.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    let html = '';

    html += `<button onclick="renderChaptersTable(${chaptersCurrentPage - 1})" ${chaptersCurrentPage === 1 ? 'disabled' : ''}>← Trước</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button onclick="renderChaptersTable(${i})" class="${i === chaptersCurrentPage ? 'active' : ''}">${i}</button>`;
    }

    html += `<button onclick="renderChaptersTable(${chaptersCurrentPage + 1})" ${chaptersCurrentPage === totalPages ? 'disabled' : ''}>Sau →</button>`;

    html += `<span class="page-info">${chaptersCurrentPage} / ${totalPages}</span>`;

    paginationContainer.innerHTML = html;
}

function getChapterStatusClass(status) {
    switch(status) {
        case 'published': return 'status status-published';
        case 'draft': return 'status status-draft';
        default: return 'status status-draft';
    }
}

function getChapterStatusText(status) {
    switch(status) {
        case 'published': return 'Đã xuất bản';
        case 'draft': return 'Nháp';
        default: return 'Nháp';
    }
}

function populateStoryFilter(stories) {
    const filter = document.getElementById('chapterStoryFilter');
    if (!filter) return;

    const currentValue = filter.value;
    const options = '<option value="all">Tất cả truyện</option>';
    const storyOptions = stories.map(s => 
        `<option value="${s.id}">${escapeHtml(s.title)}</option>`
    ).join('');

    filter.innerHTML = options + storyOptions;
    filter.value = currentValue;
}

function attachChapterActions() {
    document.querySelectorAll('.actions .edit-chapter').forEach(icon => {
        icon.addEventListener('click', async () => {
            const chapterId = icon.getAttribute('data-id');
            await openChapterModal(chapterId);
        });
    });

    document.querySelectorAll('.actions .delete-chapter').forEach(icon => {
        icon.addEventListener('click', async () => {
            const chapterId = icon.getAttribute('data-id');
            if (confirm('Bạn chắc chắn muốn xóa chương này?')) {
                await deleteChapter(chapterId);
            }
        });
    });
}

async function openChapterModal(chapterId = null) {
    const modal = document.getElementById('chapterModal');
    if (!modal) return;

    const modalTitle = document.getElementById('chapterModalTitle');
    const chapterIdInput = document.getElementById('chapterId') || createHiddenInput('chapterId');

    document.getElementById('chapterStory').value = '';
    document.getElementById('chapterNumber').value = '';
    document.getElementById('chapterTitle').value = '';
    document.getElementById('chapterContent').value = '';
    const vipEl = document.getElementById('chapterIsVip');
    if (vipEl) vipEl.checked = false;
    const priceEl = document.getElementById('chapterPrice');
    if (priceEl) priceEl.value = '';

    if (chapterId) {
        modalTitle.textContent = 'Chỉnh sửa chương';
        chapterIdInput.value = chapterId;

        try {
            const headers = getAuthHeaders();
            const res = await fetch(`/author/chapters/${chapterId}`, { headers });
            if (res.ok) {
                const chapter = await res.json();
                document.getElementById('chapterStory').value = chapter.storyId || '';
                document.getElementById('chapterNumber').value = chapter.number || '';
                document.getElementById('chapterTitle').value = chapter.title || '';
                document.getElementById('chapterContent').value = chapter.content || '';
                const vipEl2 = document.getElementById('chapterIsVip');
                if (vipEl2) vipEl2.checked = !!chapter.isVip;
                const priceEl2 = document.getElementById('chapterPrice');
                if (priceEl2) priceEl2.value = chapter.priceCoins != null ? String(chapter.priceCoins) : '';
            }
        } catch (e) {
            console.error('Error loading chapter', e);
        }
    } else {
        modalTitle.textContent = 'Tạo chương mới';
        chapterIdInput.value = '';
    }

    modal.style.display = 'flex';
}

function createHiddenInput(id) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.id = id;
    document.getElementById('chapterModal').querySelector('.modal-content').appendChild(input);
    return input;
}

async function saveChapter() {
    const chapterId = document.getElementById('chapterId')?.value;
    const storyId = document.getElementById('chapterStory').value.trim();
    const number = document.getElementById('chapterNumber').value.trim();
    const title = document.getElementById('chapterTitle').value.trim();
    const content = document.getElementById('chapterContent').value.trim();

    if (!storyId || !number || !title || !content) {
        alert('Vui lòng điền đầy đủ thông tin chương');
        return;
    }

    const payload = {
        storyId,
        number: parseInt(number, 10),
        title,
        content,
        isVip: !!(document.getElementById('chapterIsVip') && document.getElementById('chapterIsVip').checked),
        priceCoins: parseInt(document.getElementById('chapterPrice')?.value || '0', 10) || 0,
        status: 'pending'
    };

    try {
        const headers = {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
        };

        const url = chapterId ? `/author/chapters/${chapterId}` : '/author/chapters';
        const method = chapterId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(chapterId ? 'Cập nhật chương thành công!' : 'Tạo chương thành công!');
            document.getElementById('chapterModal').style.display = 'none';
            loadAuthorChapters();
        } else {
            const error = await res.json();
            alert('Lỗi: ' + (error.message || 'Không thành công'));
        }
    } catch (e) {
        console.error('Error saving chapter', e);
        alert('Lỗi: ' + e.message);
    }
}

async function deleteChapter(chapterId) {
    try {
        const headers = getAuthHeaders();
        const res = await fetch(`/author/chapters/${chapterId}`, {
            method: 'DELETE',
            headers
        });

        if (res.ok) {
            alert('Xóa chương thành công!');
            loadAuthorChapters();
        } else {
            alert('Lỗi: Không thể xóa chương');
        }
    } catch (e) {
        console.error('Error deleting chapter', e);
        alert('Lỗi: ' + e.message);
    }
}

function filterChapters() {
    const searchQuery = (document.getElementById('chapterSearch')?.value || '').toLowerCase();
    const selectedStory = document.getElementById('chapterStoryFilter')?.value || 'all';

    if (!searchQuery && selectedStory === 'all') {
        isChaptersFiltering = false;
        chaptersCurrentPage = 1;
        renderChaptersTable(1);
        return;
    }

    const filteredData = chaptersData.filter(chapter => {
        const storyMatch = selectedStory === 'all' || String(chapter.storyId) === selectedStory;
        const searchMatch = chapter.title.toLowerCase().includes(searchQuery) || 
                           (chapter.storyTitle || '').toLowerCase().includes(searchQuery) ||
                           String(chapter.number).includes(searchQuery);
        return storyMatch && searchMatch;
    });

    isChaptersFiltering = true;
    chaptersFilteredData = filteredData;
    chaptersCurrentPage = 1;
    renderChaptersTable(1);
}

async function populateChapterStorySelect() {
    try {
        const select = document.getElementById('chapterStory');
        if (!select) return;

        const headers = getAuthHeaders();
        const res = await fetch('/author/stories?limit=1000', { headers });
        
        if (res.ok) {
            const result = await res.json();
            const stories = result.data || [];
            
            const options = '<option value="">-- Chọn truyện --</option>';
            const storyOptions = stories.map(s => 
                `<option value="${s._id}">${escapeHtml(s.title)}</option>`
            ).join('');

            select.innerHTML = options + storyOptions;
        }
    } catch (e) {
        console.error('Error loading stories for chapter select', e);
    }
}

// ==================== COMMENTS MANAGEMENT ====================

async function loadAuthorComments() {
    try {
        const headers = getAuthHeaders();
        const res = await fetch('/author/comments?sort=createdAt&order=desc', { headers });

        if (!res.ok) {
            const container = document.getElementById('commentsContainer');
            if (container) container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">Không thể tải dữ liệu</p>';
            return;
        }

        const result = await res.json();
        commentsData = result.data || [];
        commentsFilteredData = [];
        isCommentsFiltering = false;

        if (commentsData.length === 0) {
            const container = document.getElementById('commentsContainer');
            if (container) container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">Chưa có bình luận nào</p>';
            populateCommentStoryFilter([]);
            const paginationContainer = document.getElementById('commentsPagination');
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }

        const uniqueStories = [...new Set(commentsData.map(c => JSON.stringify({ id: c.storyId, title: c.storyTitle })))].map(s => JSON.parse(s));
        populateCommentStoryFilter(uniqueStories);

        commentsCurrentPage = 1;
        renderComments(1);
    } catch (e) {
        console.error('Load comments error', e);
        const container = document.getElementById('commentsContainer');
        if (container) container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">Lỗi khi tải dữ liệu</p>';
    }
}

function renderComments(page = 1) {
    commentsCurrentPage = page;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    
    const dataSource = isCommentsFiltering ? commentsFilteredData : commentsData;
    const pageData = dataSource.slice(start, end);

    const container = document.getElementById('commentsContainer');
    if (!container) return;

    if (pageData.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">Không có bình luận nào</p>';
        return;
    }

    container.innerHTML = pageData.map(comment => {
        const readerName = escapeHtml(comment.readerName || 'Ẩn danh');
        const storyTitle = escapeHtml(comment.storyTitle || 'N/A');
        const chapterNumber = comment.chapterNumber || '—';
        const content = escapeHtml(comment.content || '');
        const createdDate = formatDate(comment.createdAt);
        const replies = comment.replies || [];

        let repliesHtml = '';
        if (replies.length > 0) {
            repliesHtml = '<div class="comment-replies">';
            replies.forEach(reply => {
                const replyAuthorName = escapeHtml(reply.authorName || 'Tác giả');
                const replyContent = escapeHtml(reply.content || '');
                const replyDate = formatDate(reply.createdAt);
                repliesHtml += `
                    <div class="reply-item">
                        <div class="reply-author">${replyAuthorName}</div>
                        <div class="reply-date">${replyDate}</div>
                        <div class="reply-content">${replyContent}</div>
                    </div>
                `;
            });
            repliesHtml += '</div>';
        }

        return `
            <div class="comment-card">
                <div class="comment-header">
                    <div class="comment-reader-name">${readerName}</div>
                    <div class="comment-story-chapter">${storyTitle} - Chương ${chapterNumber}</div>
                    <div class="comment-date">${createdDate}</div>
                </div>
                <div class="comment-content">${content}</div>
                ${repliesHtml}
                <div class="comment-actions">
                    <button class="comment-reply-btn" onclick="openReplyModal('${comment._id}', '${readerName.replace(/'/g, "\\'")}', '${content.replace(/'/g, "\\'").substring(0, 50)}...')">Trả lời</button>
                </div>
            </div>
        `;
    }).join('');

    renderCommentsPagination();
}

function renderCommentsPagination() {
    const paginationContainer = document.getElementById('commentsPagination');
    if (!paginationContainer) return;

    const dataSource = isCommentsFiltering ? commentsFilteredData : commentsData;
    const totalPages = Math.ceil(dataSource.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    let html = '';

    html += `<button onclick="renderComments(${commentsCurrentPage - 1})" ${commentsCurrentPage === 1 ? 'disabled' : ''}>← Trước</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button onclick="renderComments(${i})" class="${i === commentsCurrentPage ? 'active' : ''}">${i}</button>`;
    }

    html += `<button onclick="renderComments(${commentsCurrentPage + 1})" ${commentsCurrentPage === totalPages ? 'disabled' : ''}>Sau →</button>`;

    html += `<span class="page-info">${commentsCurrentPage} / ${totalPages}</span>`;

    paginationContainer.innerHTML = html;
}

function populateCommentStoryFilter(stories) {
    const filter = document.getElementById('commentStoryFilter');
    if (!filter) return;

    const currentValue = filter.value;
    const options = '<option value="all">Tất cả truyện</option>';
    const storyOptions = stories.map(s => 
        `<option value="${s.id}">${escapeHtml(s.title)}</option>`
    ).join('');

    filter.innerHTML = options + storyOptions;
    filter.value = currentValue;
}

function filterComments() {
    const searchQuery = (document.getElementById('commentSearch')?.value || '').toLowerCase();
    const selectedStory = document.getElementById('commentStoryFilter')?.value || 'all';

    if (!searchQuery && selectedStory === 'all') {
        isCommentsFiltering = false;
        commentsCurrentPage = 1;
        renderComments(1);
        return;
    }

    const filteredData = commentsData.filter(comment => {
        const storyMatch = selectedStory === 'all' || String(comment.storyId) === selectedStory;
        const searchMatch = comment.readerName.toLowerCase().includes(searchQuery) || 
                           (comment.storyTitle || '').toLowerCase().includes(searchQuery) ||
                           comment.content.toLowerCase().includes(searchQuery);
        return storyMatch && searchMatch;
    });

    isCommentsFiltering = true;
    commentsFilteredData = filteredData;
    commentsCurrentPage = 1;
    renderComments(1);
}

function openReplyModal(commentId, readerName, commentPreview) {
    const modal = document.getElementById('replyCommentModal');
    if (!modal) return;

    document.getElementById('replyCommentId').value = commentId;
    document.getElementById('replyContent').value = '';

    const originalDisplay = document.getElementById('originalCommentDisplay');
    originalDisplay.innerHTML = `<strong>${escapeHtml(readerName)}</strong>: ${escapeHtml(commentPreview)}`;

    modal.style.display = 'flex';
}

async function saveCommentReply() {
    const commentId = document.getElementById('replyCommentId')?.value;
    const replyContent = document.getElementById('replyContent')?.value.trim();

    if (!commentId || !replyContent) {
        alert('Vui lòng nhập nội dung trả lời');
        return;
    }

    try {
        const headers = {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
        };

        const payload = {
            content: replyContent
        };

        const res = await fetch(`/author/comments/${commentId}/reply`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('Gửi trả lời thành công!');
            document.getElementById('replyCommentModal').style.display = 'none';
            loadAuthorComments();
        } else {
            const error = await res.json();
            alert('Lỗi: ' + (error.message || 'Không thành công'));
        }
    } catch (e) {
        console.error('Error saving reply', e);
        alert('Lỗi: ' + e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAuthorOverview();
    loadTopStories();

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    const modal = document.getElementById('storyModal');
    const openCreateBtn = document.getElementById('openCreateStory');
    const closeBtn = document.getElementById('closeCreateStory');
    const saveBtn = document.getElementById('saveStoryBtn');
    const cancelBtn = document.getElementById('cancelStoryBtn');

    if (openCreateBtn) {
        openCreateBtn.addEventListener('click', () => {
            openStoryModal(null);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveStory);
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    const searchInput = document.getElementById('storySearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const rows = document.querySelectorAll('#storiesTableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    let chaptersLoaded = false;
    document.querySelector('[data-tab="chapters"]')?.addEventListener('click', () => {
        if (!chaptersLoaded) {
            chaptersLoaded = true;
            loadAuthorChapters();
        }
    });

    const chapterModal = document.getElementById('chapterModal');
    const openChapterBtn = document.getElementById('openCreateChapter');
    const closeChapterBtn = document.getElementById('closeChapterModal');
    const saveChapterBtn = document.querySelector('#chapterModal .modal-actions .btn-primary');
    const cancelChapterBtn = document.querySelector('#chapterModal .modal-actions .btn-secondary');

    if (openChapterBtn) {
        openChapterBtn.addEventListener('click', () => {
            openChapterModal(null);
            populateChapterStorySelect();
        });
    }

    if (closeChapterBtn) {
        closeChapterBtn.addEventListener('click', () => {
            chapterModal.style.display = 'none';
        });
    }

    if (cancelChapterBtn) {
        cancelChapterBtn.addEventListener('click', () => {
            chapterModal.style.display = 'none';
        });
    }

    if (saveChapterBtn) {
        saveChapterBtn.addEventListener('click', saveChapter);
    }

    window.addEventListener('click', (event) => {
        if (event.target === chapterModal) {
            chapterModal.style.display = 'none';
        }
    });

    const chapterSearch = document.getElementById('chapterSearch');
    const chapterStoryFilter = document.getElementById('chapterStoryFilter');

    if (chapterSearch) {
        chapterSearch.addEventListener('input', filterChapters);
    }

    if (chapterStoryFilter) {
        chapterStoryFilter.addEventListener('change', filterChapters);
    }

    populateChapterStorySelect();

    // ==================== COMMENTS SETUP ====================

    let commentsLoaded = false;
    document.querySelector('[data-tab="comments"]')?.addEventListener('click', () => {
        if (!commentsLoaded) {
            commentsLoaded = true;
            loadAuthorComments();
        }
    });

    const replyModal = document.getElementById('replyCommentModal');
    const closeReplyBtn = document.getElementById('closeReplyModal');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    const saveReplyBtn = document.getElementById('saveReplyBtn');

    if (closeReplyBtn) {
        closeReplyBtn.addEventListener('click', () => {
            replyModal.style.display = 'none';
        });
    }

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', () => {
            replyModal.style.display = 'none';
        });
    }

    if (saveReplyBtn) {
        saveReplyBtn.addEventListener('click', saveCommentReply);
    }

    window.addEventListener('click', (event) => {
        if (event.target === replyModal) {
            replyModal.style.display = 'none';
        }
    });

    const commentSearch = document.getElementById('commentSearch');
    const commentStoryFilter = document.getElementById('commentStoryFilter');

    if (commentSearch) {
        commentSearch.addEventListener('input', filterComments);
    }

    if (commentStoryFilter) {
        commentStoryFilter.addEventListener('change', filterComments);
    }

    // THEME TOGGLE + LOGOUT
    const themeToggle = document.getElementById('theme-toggle');
    const logoutLink = document.querySelector('.logout-link');

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeToggle) themeToggle.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggle) themeToggle.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    }

    // initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
            try {
                await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
            } catch (err) {}
            try { localStorage.removeItem('accessToken'); } catch (e) {}
            try { localStorage.removeItem('user'); } catch (e) {}
            window.location.href = '/';
        });
    }
});
