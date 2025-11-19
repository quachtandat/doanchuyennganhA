// Helper that automatically attaches Authorization header (if available)
async function fetchJSON(url, opts = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = Object.assign({}, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    // Try to parse JSON safely
    let json;
    try { json = await res.json(); } catch(e) { json = null; }
    if (res.status === 401) {
    // Not authorized - redirect to login so admin can re-authenticate
    console.warn('Admin fetch unauthorized, redirecting to login');
    window.location.href = '/auth/login';
    return json;
    }
    return json;
}

// Explicit fetch wrapper to use when sending body/patch/delete etc.
async function authFetch(url, opts = {}) {
    const token = localStorage.getItem('accessToken');
    const headers = Object.assign({}, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, Object.assign({}, opts, { headers }));
}

function paginate(total, page, pageSize){
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { totalPages, page: Math.min(Math.max(1, page), totalPages) };
}

async function loadStats() {
    const data = await fetchJSON('/admin/dashboard');
    if (!data) return;
    document.getElementById('stat-users').textContent = data.totalUsers;
    document.getElementById('stat-authors').textContent = data.totalAuthors;
    document.getElementById('stat-stories').textContent = data.totalStories;
    document.getElementById('stat-chapters').textContent = data.totalChapters;
}

async function loadRequests() {
    const list = await fetchJSON('/author-requests');
    const tbody = document.querySelector('#requests-table tbody');
    tbody.innerHTML = '';
    (list || []).forEach(r => {
    const tr = document.createElement('tr');
    const approved = r.status === 'approved' || r.status === 'rejected';
    tr.innerHTML = `<td>${r.userId?.name||''}</td><td>${r.message||''}</td><td>${r.status}</td>
    <td>
        ${approved ? '' : `<button class="btn btn-sm btn-success" data-id="${r._id}" data-action="approve">Duyệt</button>
        <button class="btn btn-sm btn-danger" data-id="${r._id}" data-action="reject">Từ chối</button>`}
    </td>`;
    tbody.appendChild(tr);
    });
    tbody.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    await authFetch(`/author-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
    });
    loadRequests();
    };
}

loadStats();
loadRequests();

let usersPage=1; const usersPageSize=10;
async function loadUsers(){
    const skip = (usersPage-1)*usersPageSize;
    // include search and role filter
    const q = encodeURIComponent(document.getElementById('user-search')?.value || '');
    const role = encodeURIComponent(document.getElementById('user-role-filter')?.value || '');
    const users = await fetchJSON(`/users?skip=${skip}&limit=${usersPageSize}${q?`&q=${q}`:''}${role?`&role=${role}`:''}`);
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    (users || []).forEach(u => {
    const tr = document.createElement('tr');
    // prevent editing admin accounts from UI
    const disableAdmin = u.role === 'admin';
    tr.innerHTML = `<td>${u.name||''}</td><td>${u.email||''}</td>
        <td>
        <select class="form-select form-select-sm" data-id="${u._id}" data-role ${disableAdmin? 'disabled':''}>
            <option value="reader" ${u.role==='reader'?'selected':''}>reader</option>
            <option value="author" ${u.role==='author'?'selected':''}>author</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
        </select>
        </td>
        <td>
        <select class="form-select form-select-sm" data-id="${u._id}" data-status ${disableAdmin? 'disabled':''}>
            <option value="active" ${u.status==='active'?'selected':''}>active</option>
            <option value="blocked" ${u.status==='blocked'?'selected':''}>blocked</option>
        </select>
        </td>
        <td>
        ${disableAdmin ? '' : `<button class="btn btn-sm btn-danger" data-id="${u._id}" data-delete>Xóa</button>`}
        </td>`;
    tbody.appendChild(tr);
    });
    renderUsersPager();
    tbody.onchange = async (e) => {
    const sel = e.target.closest('select[data-role]');
    const selStatus = e.target.closest('select[data-status]');
    if (sel) {
        const id = sel.getAttribute('data-id');
        const role = sel.value;
        if (confirm('Bạn có chắc muốn đổi vai trò người dùng?')) {
        await authFetch(`/users/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ role }) });
        } else {
        loadUsers();
        }
    } else if (selStatus) {
        const id = selStatus.getAttribute('data-id');
        const status = selStatus.value;
        if (confirm(status==='blocked' ? 'Ban tài khoản này?' : 'Mở ban tài khoản này?')) {
        await authFetch(`/users/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ status }) });
        } else {
        loadUsers();
        }
    }
    };
    tbody.onclick = async (e) => {
    const btn = e.target.closest('button[data-delete]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (confirm('Xóa người dùng?')) {
        await authFetch(`/users/${id}`, { method: 'DELETE' });
        loadUsers();
    }
    };
}
loadUsers();
// user search handlers
document.getElementById('user-search-btn').onclick = () => { usersPage = 1; loadUsers(); };
document.getElementById('user-clear-btn').onclick = () => { document.getElementById('user-search').value=''; document.getElementById('user-role-filter').value=''; usersPage = 1; loadUsers(); };
function renderUsersPager(){
    let pager = document.getElementById('users-pager');
    if (!pager) {
    pager = document.createElement('div');
    pager.id = 'users-pager';
    pager.className = 'd-flex justify-content-between align-items-center my-2';
    document.querySelector('#users-table').after(pager);
    }
    pager.innerHTML = `
    <button class="btn btn-sm btn-outline-secondary" id="users-prev">Trang trước</button>
    <span>Trang ${usersPage}</span>
    <button class="btn btn-sm btn-outline-secondary" id="users-next">Trang sau</button>
    `;
    pager.querySelector('#users-prev').onclick = () => { if (usersPage>1){ usersPage--; loadUsers(); } };
    pager.querySelector('#users-next').onclick = () => { usersPage++; loadUsers(); };
}

// Manage Stories
let storiesPage=1; const storiesPageSize=10;
async function loadStories(){
    const skip=(storiesPage-1)*storiesPageSize;
    // support title search and optionally populate author
    const q = encodeURIComponent(document.getElementById('story-search')?.value || '');
    const authorNameParam = encodeURIComponent(document.getElementById('story-author-filter')?.value || '');
    const url = `/stories?skip=${skip}&limit=${storiesPageSize}${q?`&q=${q}`:''}${authorNameParam?`&authorName=${authorNameParam}`:''}&populateAuthor=1`;
    const stories = await fetchJSON(url);
    const tbody = document.querySelector('#stories-table tbody');
    tbody.innerHTML = '';
    (stories || []).forEach(s => {
        const tr = document.createElement('tr');
        const authorDisplay = s.authorId && (s.authorId.author_info?.display_name || s.authorId.name) ? (s.authorId.author_info?.display_name || s.authorId.name) : (s.authorId || '');
        tr.innerHTML = `<td>${s.title}</td><td>${authorDisplay}</td><td>${s.status}</td>
        <td>
            <button class="btn btn-sm btn-success" data-id="${s._id}" data-action="approve">Duyệt</button>
            <button class="btn btn-sm btn-warning" data-id="${s._id}" data-action="reject">Từ chối</button>
            <button class="btn btn-sm btn-danger" data-id="${s._id}" data-action="delete">Xóa</button>
        </td>`;
        tbody.appendChild(tr);
    });
    renderStoriesPager();
    tbody.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'approve') {
        await authFetch(`/stories/${id}/approve`, { method: 'PUT' });
    } else if (action === 'reject') {
        await authFetch(`/stories/${id}/reject`, { method: 'PUT' });
    } else if (action === 'toggleHide') {
        const row = btn.closest('tr');
        const isHiddenText = row.children[3].textContent;
        const isHidden = isHiddenText === 'Ẩn';
        await authFetch(`/stories/${id}/${isHidden ? 'unhide' : 'hide'}`, { method: 'PUT' });
    } else if (action === 'delete') {
        if (confirm('Bạn có chắc muốn xóa truyện này?')) {
        await authFetch(`/stories/${id}`, { method: 'DELETE' });
        }
    }
    loadStories();
    };
}
loadStories();
document.getElementById('story-search-btn').onclick = () => { storiesPage = 1; loadStories(); };
document.getElementById('story-clear-btn').onclick = () => { document.getElementById('story-search').value=''; document.getElementById('story-author-filter').value=''; storiesPage = 1; loadStories(); };
function renderStoriesPager(){
    let pager = document.getElementById('stories-pager');
    if (!pager) {
    pager = document.createElement('div');
    pager.id = 'stories-pager';
    pager.className = 'd-flex justify-content-between align-items-center my-2';
    document.querySelector('#stories-table').after(pager);
    }
    pager.innerHTML = `
    <button class="btn btn-sm btn-outline-secondary" id="stories-prev">Trang trước</button>
    <span>Trang ${storiesPage}</span>
    <button class="btn btn-sm btn-outline-secondary" id="stories-next">Trang sau</button>
    `;
    pager.querySelector('#stories-prev').onclick = () => { if (storiesPage>1){ storiesPage--; loadStories(); } };
    pager.querySelector('#stories-next').onclick = () => { storiesPage++; loadStories(); };
}

// Manage Chapters
let chaptersPage=1; const chaptersPageSize=10;
async function loadChapters(){
    const skip=(chaptersPage-1)*chaptersPageSize;
    const q = encodeURIComponent(document.getElementById('chapter-search')?.value || '');
    const storyFilterName = (document.getElementById('chapter-story-filter')?.value || '').toLowerCase();
    const storyParam = encodeURIComponent(document.getElementById('chapter-story-filter')?.value || '');
    // fetch chapters (page-limited) and a small story map for titles/authors
    const chapters = await fetchJSON(`/chapters?skip=${skip}&limit=${chaptersPageSize}${q?`&q=${q}`:''}${storyParam?`&storyTitle=${storyParam}`:''}`);
    const chaptersList = chapters || [];
    const storiesMap = {};
    const storiesMeta = {};
    try {
        const allStories = await fetchJSON('/stories?limit=200&populateAuthor=1');
        (allStories || []).forEach(s => {
            const id = s._id || s.id;
            storiesMap[id] = s.title;
            storiesMeta[id] = s;
        });
    } catch (e) { /* ignore */ }

    // group chapters by story id
    const groups = {};
    chaptersList.forEach(c => {
        const sid = c.storyId && typeof c.storyId === 'object' ? (c.storyId._id || c.storyId.id) : (c.storyId || 'unknown');
        if (!groups[sid]) groups[sid] = { story: (typeof c.storyId === 'object' ? c.storyId : null), chapters: [] };
        groups[sid].chapters.push(c);
    });

    const container = document.getElementById('chapters-list');
    if (!container) return;
    container.innerHTML = '';

    // helper to escape HTML
    const esc = (s) => String(s||'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });

    Object.keys(groups).forEach((sid, idx) => {
        const grp = groups[sid];
        const storyObj = grp.story || storiesMeta[sid] || {};
        const title = esc(storyObj.title || storiesMap[sid] || 'Không rõ');
        // Resolve author display name from a few possible shapes returned by the API
        let _authorName = '';
        try {
            if (storyObj) {
                // storyObj may already be a full story with nested authorId
                if (storyObj.author_info && storyObj.author_info.display_name) _authorName = storyObj.author_info.display_name;
                else if (storyObj.authorId && storyObj.authorId.author_info && storyObj.authorId.author_info.display_name) _authorName = storyObj.authorId.author_info.display_name;
                else if (storyObj.authorId && storyObj.authorId.name) _authorName = storyObj.authorId.name;
                else if (storyObj.author) _authorName = storyObj.author;
            }
            // check storiesMeta as additional fallback
            if (!_authorName && storiesMeta[sid]) {
                const s = storiesMeta[sid];
                if (s.authorId && s.authorId.author_info && s.authorId.author_info.display_name) _authorName = s.authorId.author_info.display_name;
                else if (s.authorId && s.authorId.name) _authorName = s.authorId.name;
            }
        } catch (e) { /* ignore shape errors */ }
        if (!_authorName) _authorName = 'Ẩn danh';
        const author = esc(_authorName);

        const card = document.createElement('div');
        card.className = 'card mb-2';

        const header = document.createElement('div');
        header.className = 'card-header d-flex justify-content-between align-items-center';
        header.innerHTML = `<div><button class="btn btn-sm btn-outline-secondary me-2 group-toggle" data-sid="${sid}">[+]</button><strong>${title}</strong> <small class="text-muted">— Tác giả: ${author}</small></div><div><small class="text-muted">${grp.chapters.length} chương</small></div>`;
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'card-body p-2 d-none';

        const list = document.createElement('div');
        list.className = 'list-group';

        grp.chapters.forEach(c => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            const chapterTitle = esc(c.title || '');
            item.innerHTML = `<div class="me-3"><div><strong>Chương ${esc(c.number)}: ${chapterTitle}</strong></div><div class="text-muted small">${esc(c.status)}</div></div><div class="btn-group btn-group-sm" role="group"><button class="btn btn-success" data-id="${c._id}" data-action="publish">Duyệt</button><button class="btn btn-warning" data-id="${c._id}" data-action="reject">Từ chối</button><button class="btn btn-danger" data-id="${c._id}" data-action="delete">Xóa</button></div>`;
            list.appendChild(item);
        });

        body.appendChild(list);
        card.appendChild(body);
        container.appendChild(card);
    });

    // attach delegation for toggles and actions
    container.onclick = async (e) => {
        const toggle = e.target.closest('.group-toggle');
        if (toggle) {
            const sid = toggle.getAttribute('data-sid');
            const card = toggle.closest('.card');
            const body = card.querySelector('.card-body');
            const opened = !body.classList.contains('d-none');
            if (opened) {
                body.classList.add('d-none');
                toggle.textContent = '[+]';
            } else {
                body.classList.remove('d-none');
                toggle.textContent = '[-]';
            }
            return;
        }

        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'publish') {
            await authFetch(`/chapters/${id}/publish`, { method: 'PATCH' });
        } else if (action === 'reject') {
            await authFetch(`/chapters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft' }) });
        } else if (action === 'delete') {
            if (confirm('Bạn có chắc muốn xóa chương này?')) {
                await authFetch(`/chapters/${id}`, { method: 'DELETE' });
            }
        }
        // refresh list
        loadChapters();
    };

    // render pager if desired (keeps previous UI)
    renderChaptersPager();
}
loadChapters();
document.getElementById('chapter-search-btn').onclick = () => { chaptersPage = 1; loadChapters(); };
document.getElementById('chapter-clear-btn').onclick = () => { document.getElementById('chapter-search').value=''; document.getElementById('chapter-story-filter').value=''; chaptersPage = 1; loadChapters(); };
function renderChaptersPager(){
    let pager = document.getElementById('chapters-pager');
    if (!pager) {
    pager = document.createElement('div');
    pager.id = 'chapters-pager';
    pager.className = 'd-flex justify-content-between align-items-center my-2';
    const attachAfter = document.querySelector('#chapters-table') || document.querySelector('#chapters-list');
    if (attachAfter) attachAfter.after(pager);
    }
    pager.innerHTML = `
    <button class="btn btn-sm btn-outline-secondary" id="chapters-prev">Trang trước</button>
    <span>Trang ${chaptersPage}</span>
    <button class="btn btn-sm btn-outline-secondary" id="chapters-next">Trang sau</button>
    `;
    pager.querySelector('#chapters-prev').onclick = () => { if (chaptersPage>1){ chaptersPage--; loadChapters(); } };
    pager.querySelector('#chapters-next').onclick = () => { chaptersPage++; loadChapters(); };
}

// Reports handling (client-side filter)
async function loadReports(){
    const list = await fetchJSON('/reports');
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';
    const storyFilter = (document.getElementById('report-story-filter')?.value || '').toLowerCase();
    const fromVal = document.getElementById('report-from')?.value;
    const toVal = document.getElementById('report-to')?.value;
    const fromTs = fromVal ? new Date(fromVal).getTime() : null;
    const toTs = toVal ? (new Date(toVal).getTime() + 24*3600*1000 - 1) : null;
    (list || []).forEach(r => {
    const storyTitle = r.storyId?.title || '';
    if (storyFilter && !storyTitle.toLowerCase().includes(storyFilter)) return;
    const created = new Date(r.createdAt || r.createdAt);
    const tms = created.getTime();
    if (fromTs && tms < fromTs) return;
    if (toTs && tms > toTs) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${created.toLocaleString('vi-VN')}</td><td>${storyTitle}</td><td>${r.chapterId?.title||''}</td><td>${r.userId?.name||'Khách'}</td><td>${r.content||r.reason||''}</td>
        <td>
        <button class="btn btn-sm btn-danger" data-id="${r._id}" data-action="remove">Xóa</button>
        </td>`;
    tbody.appendChild(tr);
    });
    tbody.onclick = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'remove') {
        if (confirm('Xóa báo cáo này?')) {
        await authFetch(`/reports/${id}`, { method: 'DELETE' });
        loadReports();
        }
    }
    };
}
document.getElementById('report-search-btn').onclick = () => loadReports();
document.getElementById('report-clear-btn').onclick = () => { document.getElementById('report-story-filter').value=''; document.getElementById('report-from').value=''; document.getElementById('report-to').value=''; loadReports(); };
loadReports();

// --- Simple in-page navigation for admin sections ---
;(function(){
    const navLinks = document.querySelectorAll('nav.sidebar a[data-target]');
    const sections = Array.from(document.querySelectorAll('main section'));

    function showSectionId(id) {
        sections.forEach(s => {
            if ('#' + (s.id || '') === id) s.classList.remove('d-none');
            else s.classList.add('d-none');
        });
        navLinks.forEach(a => {
            try { a.classList.toggle('active', a.getAttribute('data-target') === id); } catch (e) {}
        });
    }

    // click handlers
    navLinks.forEach(a => {
        a.addEventListener('click', (ev) => {
            ev.preventDefault();
            const target = a.getAttribute('data-target') || a.getAttribute('href');
            if (!target) return;
            // show the section and update hash without scrolling
            history.replaceState(null, '', target);
            showSectionId(target);
        });
    });

    // on load, show section based on hash or default to dashboard
    const initial = window.location.hash || '#dashboard';
    showSectionId(initial);
    // --- header controls: theme toggle, logout, global search ---
    const themeToggle = document.getElementById('theme-toggle');
    const logoutBtn = document.getElementById('admin-logout');
    const globalSearch = document.getElementById('global-search');

    // restore saved theme
    try {
        const saved = localStorage.getItem('adminTheme');
        if (saved === 'dark') document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
    } catch (e) {}

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-theme');
            try { localStorage.setItem('adminTheme', isDark ? 'dark' : 'light'); } catch (e) {}
            themeToggle.textContent = isDark ? '☀️' : '🌙';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                // Attempt to notify server to revoke the token if endpoint exists
                try {
                    await authFetch('/auth/logout', { method: 'POST' });
                } catch (err) {
                    // ignore network errors — proceed with client-side logout
                }
                localStorage.removeItem('accessToken');
            } catch (err) {}
            window.location.href = '/auth/login';
        });
    }

    if (globalSearch) {
        // debounce helper
        let t;
        globalSearch.addEventListener('input', (ev) => {
            clearTimeout(t);
            const q = (ev.target.value || '').trim();
            t = setTimeout(() => {
                if (!q) return;
                // forward the query into the stories search and show stories section
                const storyInput = document.getElementById('story-search');
                if (storyInput) storyInput.value = q;
                // set page and trigger load
                try { storiesPage = 1; } catch (e) {}
                // show stories section
                showSectionId('#stories');
                try { loadStories(); } catch (e) {}
            }, 350);
        });
        // also search on Enter
        globalSearch.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                const q = (globalSearch.value || '').trim();
                if (!q) return;
                const storyInput = document.getElementById('story-search');
                if (storyInput) storyInput.value = q;
                try { storiesPage = 1; loadStories(); } catch (e) {}
                showSectionId('#stories');
            }
        });
    }
})();

// --- Decorate native date inputs with a visible trigger and dark-theme aware icon ---
(function(){
    try {
        const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
        dateInputs.forEach(inp => {
            // ensure wrapper
            let wrap = inp.closest('.date-input-wrap');
            if (!wrap) {
                wrap = document.createElement('span');
                wrap.className = 'date-input-wrap';
                inp.parentNode.insertBefore(wrap, inp);
                wrap.appendChild(inp);
            }

            // create trigger button
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'date-trigger';
            btn.setAttribute('aria-label', 'Open calendar');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h.5A1.5 1.5 0 0 1 15 2.5v11A1.5 1.5 0 0 1 13.5 15h-11A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1H3V.5a.5.5 0 0 1 .5-.5zM2.5 3A.5.5 0 0 0 2 3.5V5h12V3.5a.5.5 0 0 0-.5-.5h-11zM14 6H2v7.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V6z"/></svg>';

            // place button (avoid adding multiple)
            if (!wrap.querySelector('.date-trigger')) wrap.appendChild(btn);

            const openPicker = () => {
                // modern API
                if (typeof inp.showPicker === 'function') {
                    inp.showPicker();
                } else {
                    inp.focus();
                    // fallback: dispatch click to try to open native picker
                    try { inp.click(); } catch(e) {}
                }
            };

            btn.addEventListener('click', (e) => { e.preventDefault(); openPicker(); });

            // if browser shows native indicator well, hide our button on that browser by feature-detecting native indicator width
            // we keep it simple: if computed style of ::-webkit-calendar-picker-indicator is available, still show (some browsers hide)
        });
    } catch (e) {
        // no-op
    }
})();