// Helper to include Authorization header when token exists
async function fetchJSON(url, opts = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = opts.headers || {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...opts, headers });
    // If unauthorized, throw so caller can handle redirect to login
    if (res.status === 401 || res.status === 403) throw new Error('Unauthorized');
    return res.json();
}

document.getElementById('create-story-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
    const token = localStorage.getItem('accessToken');
    if (!token) return window.location.href = '/auth/login';

    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    // Normalize category into array and expectedTotalChapters into number/null
    body.category = body.category ? body.category.split(',').map(s => s.trim()).filter(Boolean) : [];
    body.expectedTotalChapters = body.expectedTotalChapters ? Number(body.expectedTotalChapters) : null;
    await fetchJSON('/author/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    e.target.reset();
    await loadMyStories();
    } catch (err) {
    console.error(err);
    alert('Không thể tạo truyện. Vui lòng đăng nhập lại.');
    window.location.href = '/auth/login';
    }
};

async function loadMyStories(){
    try {
    const me = await fetchJSON('/auth/profile');
    if (!me || me.role !== 'author') return document.body.innerHTML = '<div class="container py-4"><h3>Không có quyền truy cập trang tác giả</h3></div>';

    const authorId = me.id || me._id || me.user?.id || '';
    console.log('Author page: profile id resolved to authorId =', authorId);
    const stories = await fetchJSON(`/stories?limit=100&authorId=${encodeURIComponent(authorId)}`);
    console.log('Author page: /stories response:', stories);
    const mine = Array.isArray(stories) ? stories : (stories.data || []);
    const wrap = document.getElementById('my-stories');
    wrap.innerHTML = '';
    mine.forEach(s => {
        const a = document.createElement('div');
        a.className = 'list-group-item d-flex justify-content-between align-items-center';
        a.setAttribute('data-story-id', s._id);
        a.setAttribute('data-story-title', s.title || '');
        a.innerHTML = `<div><strong>${s.title}</strong> <small class="text-muted">(${s.status})</small></div>
        <div>
            <button class="btn btn-sm btn-outline-secondary" data-id="${s._id}" data-action="edit-story">Sửa</button>
            <button class="btn btn-sm btn-outline-primary" data-id="${s._id}" data-action="add-chapter">Thêm chương</button>
            <button class="btn btn-sm btn-outline-danger" data-id="${s._id}" data-action="delete-story">Xóa</button>
        </div>`;
        wrap.appendChild(a);
    });
    wrap.onclick = async (e) => {
        const btn = e.target.closest('button');
        const item = e.target.closest('.list-group-item');
        if (!btn && item) {
        // Open chapters panel for this story
        const storyId = item.getAttribute('data-story-id');
        const storyTitle = item.getAttribute('data-story-title');
        if (storyId) {
            await showChaptersForStory(storyId, storyTitle);
        }
        return;
        }
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        try {
        if (action === 'delete-story') {
            if (!confirm('Bạn có chắc chắn muốn xóa truyện này?')) return;
            await fetchJSON(`/author/stories/${id}`, { method: 'DELETE' });
            await loadMyStories();
        } else if (action === 'add-chapter') {
            // open add chapter form for this story
            await openChapterForm({ mode: 'create', storyId: id });
        } else if (action === 'edit-story') {
            // open create/edit panel in edit mode
            const res = await fetchJSON(`/stories/${encodeURIComponent(id)}`);
            const story = res && (res.data || res) ? (res.data || res) : res;
            openCreateStoryPanel(true, story);
        }
        } catch (err) {
        console.error(err);
        alert('Hành động thất bại. Vui lòng kiểm tra quyền hoặc đăng nhập lại.');
        }
    };
    
    // Back button from chapters panel
    const btnBack = document.getElementById('btn-back-to-stories');
    if (btnBack) btnBack.onclick = () => {
        document.getElementById('chapters-panel').style.display = 'none';
        document.querySelector('.card.p-3').style.display = 'block';
    };

    // Add chapter from panel
    const btnAddPanel = document.getElementById('btn-add-chapter-panel');
    if (btnAddPanel) btnAddPanel.onclick = async () => {
        const storyId = btnAddPanel.getAttribute('data-story-id');
        if (!storyId) return alert('Không xác định truyện');
        await openChapterForm({ mode: 'create', storyId });
    };

    async function showChaptersForStory(storyId, storyTitle) {
        try {
        document.querySelector('.card.p-3').style.display = 'none';
        const panel = document.getElementById('chapters-panel');
        panel.style.display = 'block';
        document.getElementById('chapters-title').textContent = 'Danh sách chương: ' + (storyTitle || '');
        document.getElementById('btn-add-chapter-panel').setAttribute('data-story-id', storyId);
        // load chapters via public API
        const chapters = await fetchJSON(`/api/story/${encodeURIComponent(storyId)}/chapters`);
        renderChaptersList(chapters, storyId);
        } catch (err) {
        console.error('showChaptersForStory', err);
        alert('Không tải được danh sách chương');
        }
    }

    function renderChaptersList(chapters, storyId) {
        const list = document.getElementById('chapters-list');
        list.innerHTML = '';
        (chapters || []).forEach(ch => {
        const li = document.createElement('div');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `<div><strong>Chương ${ch.number}:</strong> ${ch.title} <div class="small text-muted">VIP: ${ch.isVip ? 'Có' : 'Không'} • Giá: ${ch.priceCoins || 0} Coins</div></div>
            <div>
            <button class="btn btn-sm btn-outline-secondary" data-id="${ch.id}" data-action="edit-chapter">Sửa</button>
            <button class="btn btn-sm btn-outline-danger" data-id="${ch.id}" data-action="delete-chapter">Xóa</button>
            </div>`;
        li.setAttribute('data-chapter-id', ch.id);
        list.appendChild(li);
        });

        list.onclick = async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'delete-chapter') {
            if (!confirm('Bạn có chắc chắn muốn xóa chương này?')) return;
            await fetchJSON(`/author/chapters/${id}`, { method: 'DELETE' });
            // reload
            await showChaptersForStory(storyId);
        } else if (action === 'edit-chapter') {
            // fetch chapter details then open edit form
            try {
            const chRes = await fetchJSON(`/author/chapters/${encodeURIComponent(id)}`);
            const chapter = chRes && (chRes.data || chRes) ? (chRes.data || chRes) : chRes;
            await openChapterForm({ mode: 'edit', chapterId: id, storyId, chapter });
            } catch (err) {
            console.error('Không tải được thông tin chương', err);
            alert('Không tải được thông tin chương để sửa');
            }
        }
        };
    }
    // Chapter form panel (hidden) - will be inserted into chapters-panel
    const chaptersPanel = document.getElementById('chapters-panel');
    const chapterFormHtml = `
        <div id="chapter-form-panel" style="display:none; margin-top:12px;">
        <form id="chapter-form">
            <input type="hidden" name="_id" />
            <div class="row g-2">
            <div class="col-md-3"><input class="form-control" placeholder="Tiêu đề chương" name="title" required></div>
            <div class="col-md-2"><input class="form-control" placeholder="Số chương" name="number" type="number" required></div>
            <div class="col-md-2"><input class="form-control" placeholder="Giá Coins" name="priceCoins" type="number" min="0" value="0"></div>
            <div class="col-md-2"><label class="form-check-label"><input type="checkbox" name="isVip" class="form-check-input"> VIP</label></div>
            <div class="col-12"><textarea class="form-control" placeholder="Nội dung" name="content"></textarea></div>
            </div>
            <div class="mt-2">
            <button class="btn btn-primary">Lưu chương</button>
            <button type="button" id="btn-cancel-chapter" class="btn btn-secondary">Hủy</button>
            </div>
        </form>
        </div>
    `;
    chaptersPanel.insertAdjacentHTML('beforeend', chapterFormHtml);

    // Show/hide create-story panel
    const btnOpenCreate = document.getElementById('btn-open-create-story');
    const createPanel = document.getElementById('create-story-panel');
    const createForm = document.getElementById('create-story-form');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    let currentEditingStoryId = null;

    btnOpenCreate.onclick = () => openCreateStoryPanel(false, null);
    btnCancelCreate.onclick = (ev) => { ev.preventDefault(); openCreateStoryPanel(false, null, true); };

    function openCreateStoryPanel(edit=false, story=null, hide=false) {
        if (hide) {
        createPanel.style.display = 'none';
        currentEditingStoryId = null;
        createForm.reset();
        document.getElementById('btn-submit-create').textContent = 'Tạo';
        return;
        }
        createPanel.style.display = 'block';
        if (edit && story) {
        currentEditingStoryId = story._id || story.id || story.id;
        createForm.querySelector('input[name="_id"]').value = currentEditingStoryId;
        createForm.querySelector('input[name="title"]').value = story.title || '';
        createForm.querySelector('input[name="slug"]').value = story.slug || '';
        createForm.querySelector('input[name="coverUrl"]').value = story.coverUrl || '';
        createForm.querySelector('input[name="category"]').value = (story.category || []).join(', ');
        createForm.querySelector('input[name="expectedTotalChapters"]').value = story.expectedTotalChapters || '';
        createForm.querySelector('textarea[name="description"]').value = story.description || '';
        document.getElementById('btn-submit-create').textContent = 'Cập nhật';
        } else {
        currentEditingStoryId = null;
        createForm.reset();
        document.getElementById('btn-submit-create').textContent = 'Tạo';
        }
    }

    createForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        body.category = body.category ? body.category.split(',').map(s => s.trim()).filter(Boolean) : [];
        body.expectedTotalChapters = body.expectedTotalChapters ? Number(body.expectedTotalChapters) : null;
        if (currentEditingStoryId) {
            await fetchJSON(`/author/stories/${encodeURIComponent(currentEditingStoryId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else {
            await fetchJSON('/author/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        }
        openCreateStoryPanel(false, null, true);
        await loadMyStories();
        } catch (err) {
        console.error(err);
        alert('Không thể lưu truyện. Vui lòng đăng nhập lại.');
        }
    };

    // Chapter form handlers
    const chapterFormPanel = document.getElementById('chapter-form-panel');
    const chapterForm = document.getElementById('chapter-form');
    const btnCancelChapter = document.getElementById('btn-cancel-chapter');
    let currentChapterContext = { mode: null, storyId: null, chapterId: null };

    async function openChapterForm({ mode, storyId, chapterId, chapter } = {}) {
        // Ensure chapters panel is visible and context/story loaded
        currentChapterContext = { mode, storyId, chapterId };
        try {
        const panel = document.getElementById('chapters-panel');
        // If panel is hidden (we came from story list), open it and load chapters
        if (storyId && (!panel || panel.style.display === 'none')) {
            // reuse existing helper to show the panel and load chapters
            await showChaptersForStory(storyId, '');
        }
        } catch (e) {
        console.error('openChapterForm: failed to open chapters panel', e);
        }

        chapterFormPanel.style.display = 'block';
        if (mode === 'edit' && chapter) {
        chapterForm.querySelector('input[name="_id"]').value = chapter._id || chapter.id || '';
        chapterForm.querySelector('input[name="title"]').value = chapter.title || '';
        chapterForm.querySelector('input[name="number"]').value = chapter.number || '';
        chapterForm.querySelector('input[name="priceCoins"]').value = chapter.priceCoins || 0;
        chapterForm.querySelector('textarea[name="content"]').value = chapter.content || '';
        chapterForm.querySelector('input[name="isVip"]').checked = !!chapter.isVip;
        } else {
        chapterForm.reset();
        }
    }

    btnCancelChapter.onclick = () => { chapterFormPanel.style.display = 'none'; chapterForm.reset(); };

    chapterForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        payload.number = payload.number ? Number(payload.number) : undefined;
        payload.priceCoins = payload.priceCoins ? Number(payload.priceCoins) : 0;
        payload.isVip = !!chapterForm.querySelector('input[name="isVip"]').checked;
        if (currentChapterContext.mode === 'create') {
            payload.storyId = currentChapterContext.storyId;
            await fetchJSON('/author/chapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } else if (currentChapterContext.mode === 'edit') {
            const cid = currentChapterContext.chapterId || payload._id;
            await fetchJSON(`/author/chapters/${encodeURIComponent(cid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }
        chapterFormPanel.style.display = 'none';
        chapterForm.reset();
        await showChaptersForStory(currentChapterContext.storyId);
        } catch (err) {
        console.error(err);
        alert('Lưu chương thất bại');
        }
    };
    } catch (err) {
    console.error('loadMyStories error', err);
    // If unauthorized, redirect to login
    if (err.message && err.message.includes('Unauthorized')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userData');
        return window.location.href = '/auth/login';
    }
    }
}

async function loadMyComments(){
    try {
    const comments = await fetchJSON('/author/comments');
    const ul = document.getElementById('my-comments');
    ul.innerHTML = '';
    // populate story filter select
    try {
        const me = await fetchJSON('/auth/profile');
        const authorId = me.id || me._id || me.user?.id || '';
        const stories = await fetchJSON(`/stories?limit=100&authorId=${encodeURIComponent(authorId)}`);
        const storyList = Array.isArray(stories) ? stories : (stories.data || []);
        const sel = document.getElementById('comment-filter-story');
        sel.innerHTML = '<option value="">-- Tất cả truyện --</option>';
        storyList.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st._id || st.id;
        opt.textContent = st.title || '';
        sel.appendChild(opt);
        });
    } catch (e) {
        console.error('Không tải được danh sách truyện cho filter', e);
    }

    // local filtering helpers
    function applyCommentFilter(list) {
        const storyFilter = document.getElementById('comment-filter-story').value || '';
        const chapterFilter = (document.getElementById('comment-filter-chapter').value || '').toLowerCase();
        return (list || []).filter(c => {
        if (storyFilter && (c.storyId || c.storyId === undefined)) {
            if (String(c.storyId) !== String(storyFilter) && String(c.storyId || '') !== String(storyFilter)) return false;
        }
        if (chapterFilter) {
            const chap = (c.chapterTitle || '').toLowerCase();
            if (!chap.includes(chapterFilter)) return false;
        }
        return true;
        });
    }

    const filtered = applyCommentFilter(comments || []);
    (filtered || []).forEach(c => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-start';
        const left = document.createElement('div');
        left.className = 'ms-2 me-auto';
        const title = document.createElement('div');
        title.innerHTML = `<strong>${c.storyTitle || ''}</strong> ${c.chapterTitle ? `<small class="text-muted">- ${c.chapterTitle}</small>` : ''}`;
        const meta = document.createElement('div');
        meta.className = 'small text-muted';
        meta.textContent = `${c.userName || 'Anonymous'} • ${new Date(c.createdAt).toLocaleString('vi-VN')}`;
        const content = document.createElement('div');
        content.className = 'mt-1';
        content.textContent = c.content;
        left.appendChild(title);
        left.appendChild(meta);
        left.appendChild(content);

        // append left content only (remove author-side hide/delete actions)
        li.appendChild(left);
        ul.appendChild(li);
        });

        // Filter button handlers
        document.getElementById('comment-filter-apply').onclick = () => {
        // re-render using filters
        const sel = document.getElementById('my-comments');
        sel.innerHTML = '';
        const filtered2 = applyCommentFilter(comments || []);
        (filtered2 || []).forEach(c => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-start';
            const left = document.createElement('div');
            left.className = 'ms-2 me-auto';
            const title = document.createElement('div');
            title.innerHTML = `<strong>${c.storyTitle || ''}</strong> ${c.chapterTitle ? `<small class="text-muted">- ${c.chapterTitle}</small>` : ''}`;
            const meta = document.createElement('div');
            meta.className = 'small text-muted';
            meta.textContent = `${c.userName || 'Anonymous'} • ${new Date(c.createdAt).toLocaleString('vi-VN')}`;
            const content = document.createElement('div');
            content.className = 'mt-1';
            content.textContent = c.content;
            left.appendChild(title);
            left.appendChild(meta);
            left.appendChild(content);
            // Do not render hide/delete actions for authors — only show content
            li.appendChild(left);
            sel.appendChild(li);
        });
        };
        document.getElementById('comment-filter-clear').onclick = () => {
        document.getElementById('comment-filter-story').value = '';
        document.getElementById('comment-filter-chapter').value = '';
        loadMyComments();
        };
    } catch (err) {
    console.error('loadMyComments error', err);
    }
}

loadMyStories();
loadMyComments();

// --- in-page navigation for author sidebar (Stories / Comments) ---
;(function(){
    try {
    const navLinks = Array.from(document.querySelectorAll('.sidebar .nav-link[data-target]'));
        const sections = Array.from(document.querySelectorAll('main section'));

        function showSectionId(id) {
            if (!id) id = '#author-dashboard';
            // normalize
            const norm = id.startsWith('#') ? id : ('#' + id);
            sections.forEach(s => {
                if ('#' + (s.id || '') === norm) s.classList.remove('d-none');
                else s.classList.add('d-none');
            });
            navLinks.forEach(a => {
                try { a.classList.toggle('active', a.getAttribute('data-target') === norm); } catch (e) {}
            });
        }

        navLinks.forEach(a => {
            a.addEventListener('click', (ev) => {
                ev.preventDefault();
                const target = a.getAttribute('data-target') || a.getAttribute('href');
                if (!target) return;
                history.replaceState(null, '', target);
                showSectionId(target);
            });
        });

        // On load pick hash or default
        const initial = window.location.hash || '#author-dashboard';
        showSectionId(initial);
    } catch (e) {
        console.warn('Author nav wiring failed', e);
    }
})();

// --- Theme toggle and logout handling (behaves like admin) ---
;(function(){
    try {
        const themeToggle = document.getElementById('author-theme-toggle');
        const logoutLink = document.querySelector('a[href="/auth/logout"]');

        // restore saved theme (also apply to header and sidebar for robustness)
        try {
            const saved = localStorage.getItem('authorTheme');
            if (saved === 'dark') {
                document.body.classList.add('dark-theme');
                const hdr = document.querySelector('header.navbar'); if (hdr) hdr.classList.add('dark-theme');
                const sb = document.querySelector('nav.sidebar'); if (sb) sb.classList.add('dark-theme');
            }
            // Also mark bootstrap dropdown menus to use dark variant if present
            try {
                const dmenus = Array.from(document.querySelectorAll('.dropdown-menu'));
                dmenus.forEach(m => m.classList.toggle('dropdown-menu-dark', localStorage.getItem('authorTheme') === 'dark'));
            } catch (e) {}
            if (themeToggle) themeToggle.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        } catch (e) {}

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const isDark = document.body.classList.toggle('dark-theme');
                // also toggle on header and sidebar to ensure styles apply
                const hdr = document.querySelector('header.navbar'); if (hdr) hdr.classList.toggle('dark-theme');
                const sb = document.querySelector('nav.sidebar'); if (sb) sb.classList.toggle('dark-theme');
                // toggle bootstrap dropdown dark variant for immediate effect
                try {
                    const dmenus = Array.from(document.querySelectorAll('.dropdown-menu'));
                    dmenus.forEach(m => m.classList.toggle('dropdown-menu-dark', isDark));
                } catch (e) {}
                try { localStorage.setItem('authorTheme', isDark ? 'dark' : 'light'); } catch (e) {}
                themeToggle.textContent = isDark ? '☀️' : '🌙';
            });
        }

        if (logoutLink) {
            logoutLink.addEventListener('click', async (ev) => {
                ev.preventDefault();
                try {
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                        try { await fetch('/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) { /* ignore */ }
                    }
                } catch (e) {}
                try { localStorage.removeItem('accessToken'); localStorage.removeItem('userData'); } catch(e) {}
                window.location.href = '/auth/login';
            });
        }
    } catch (e) { console.warn('Author header wiring failed', e); }
})();

// --- Avatar dropdown actions: set initials, logout, exit author mode ---
;(function(){
    try {
        const avatarMini = document.getElementById('author-avatar-mini');
        const avatarBtn = document.getElementById('author-avatar-btn');
        const logoutItem = document.getElementById('author-logout');
        const exitItem = document.getElementById('author-exit-mode');

        // set initials from stored userData
        try {
            const user = JSON.parse(localStorage.getItem('userData') || '{}');
            const name = user.name || user.display_name || '';
            const initials = name ? name.split(' ').map(p => p[0]?.toUpperCase()).join('').slice(0,2) : 'U';
            if (avatarMini) avatarMini.textContent = initials;
        } catch(e) {}

        if (logoutItem) {
            logoutItem.addEventListener('click', async (ev) => {
                ev.preventDefault();
                // reuse existing logout logic: remove token + attempt server revoke
                try { const token = localStorage.getItem('accessToken'); if (token) { try { await fetch('/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {} } } catch(e) {}
                try { localStorage.removeItem('accessToken'); localStorage.removeItem('userData'); } catch(e) {}
                window.location.href = '/auth/login';
            });
        }

        if (exitItem) {
            exitItem.addEventListener('click', (ev) => {
                ev.preventDefault();
                // exit author mode: clear any author-mode flag and redirect to site root
                try { localStorage.removeItem('authorMode'); } catch(e) {}
                window.location.href = '/';
            });
        }
    } catch (e) { console.warn('Avatar dropdown wiring failed', e); }
})();

// --- Load author stats and render charts (revenue and views) ---
async function loadAuthorStats() {
    try {
        const me = await fetchJSON('/auth/profile');
        const authorId = me.id || me._id || me.user?.id || '';
        if (!authorId) return;

        // fetch stories for author
        const storiesResp = await fetchJSON(`/stories?limit=500&authorId=${encodeURIComponent(authorId)}`);
        const stories = Array.isArray(storiesResp) ? storiesResp : (storiesResp.data || []);
        const storyIds = stories.map(s => s._id || s.id).filter(Boolean);

        // set basic stats
        document.getElementById('stat-author-stories').textContent = stories.length;

        // fetch purchases and aggregate revenue
        let purchases = [];
        try {
            const allPurch = await fetchJSON('/purchases');
            purchases = Array.isArray(allPurch) ? allPurch : (allPurch.data || allPurch || []);
        } catch (e) { purchases = []; }

        const myPurchases = (purchases || []).filter(p => p && p.storyId && storyIds.includes(String(p.storyId._id || p.storyId)) && (p.status === 'completed' || !p.status));
        const totalCoins = myPurchases.reduce((s, p) => s + (Number(p.priceCoins) || 0), 0);
        document.getElementById('stat-author-revenue').textContent = totalCoins + ' Coins';

        // fetch reading histories and compute views
        let readings = [];
        try {
            const allReadings = await fetchJSON('/reading-histories');
            readings = Array.isArray(allReadings) ? allReadings : (allReadings.data || allReadings || []);
        } catch (e) { readings = []; }

        const myReadings = (readings || []).filter(r => r && r.storyId && storyIds.includes(String(r.storyId._id || r.storyId)));
        // total views approximated by number of reading history records
        document.getElementById('stat-author-views').textContent = myReadings.length;

        // build timeseries for last 30 days (revenue and views per day)
        const DAYS = 30;
        const today = new Date();
        const dates = [];
        for (let i = DAYS-1; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            dates.push(d);
        }
        const fmt = (d) => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth()+1)).slice(-2);
        const labels = dates.map(fmt);

        const revenueByDay = Object.create(null);
        myPurchases.forEach(p => {
            const dt = new Date(p.purchaseAt || p.purchaseAt || Date.now());
            const key = fmt(dt);
            revenueByDay[key] = (revenueByDay[key] || 0) + (Number(p.priceCoins) || 0);
        });

        const viewsByDay = Object.create(null);
        myReadings.forEach(r => {
            const dt = new Date(r.lastReadAt || r.lastReadAt || Date.now());
            const key = fmt(dt);
            viewsByDay[key] = (viewsByDay[key] || 0) + 1;
        });

        const revenueSeries = labels.map(l => revenueByDay[l] || 0);
        const viewsSeries = labels.map(l => viewsByDay[l] || 0);

        // create charts (requires Chart.js loaded)
        try {
            if (typeof Chart !== 'undefined') {
                const ctxR = document.getElementById('chartRevenue');
                const ctxV = document.getElementById('chartViews');
                if (ctxR) {
                    new Chart(ctxR.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{ label: 'Doanh thu (Coins)', data: revenueSeries, borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.1)', tension: 0.2 }]
                        },
                        options: { responsive: true, plugins: { legend: { display: false } } }
                    });
                }
                if (ctxV) {
                    new Chart(ctxV.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{ label: 'Lượt xem', data: viewsSeries, borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.08)', tension: 0.2 }]
                        },
                        options: { responsive: true, plugins: { legend: { display: false } } }
                    });
                }
            }
        } catch (e) { console.warn('Chart render failed', e); }
    } catch (e) {
        console.error('loadAuthorStats failed', e);
    }
}

// call stats loader (non-blocking)
try { loadAuthorStats(); } catch (e) {}

