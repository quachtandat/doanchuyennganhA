$(document).ready(function () {
    // Story page: render interactive 5-star rating and submit to server
    try {
        const ratingContainer = document.getElementById('story-rating');
        if (!ratingContainer) return;

        // inject interactive star buttons (1..5)
        const interactiveHolder = ratingContainer.querySelector('.star-interactive');
        const starRatingVisual = ratingContainer.querySelector('.star-rating');
        const starFront = ratingContainer.querySelector('.star-front');
        const avgEl = document.getElementById('story-rating-average');
        const countEl = document.getElementById('story-rating-count');

        const origAvgRaw = parseFloat(ratingContainer.dataset.originalAverage) || 0;
        let avg = origAvgRaw;
        // if original scale is out of 5 (e.g., out of 10), normalize: if >5 assume it's out of 10
        if (origAvgRaw > 5) avg = origAvgRaw / 2;
        const count = parseInt(ratingContainer.dataset.count) || 0;

        function setVisualAverage(v) {
            const pct = Math.max(0, Math.min(100, (v / 5) * 100));
            if (starFront) starFront.style.width = pct + '%';
            if (avgEl) avgEl.textContent = (Math.round(v * 10) / 10).toFixed(1);
            if (countEl) countEl.textContent = (count || 0) + ' lượt đánh giá';
        }

        setVisualAverage(avg);

        // create buttons
        if (interactiveHolder) {
            for (let i = 1; i <= 5; i++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'star-btn';
                btn.dataset.value = i;
                btn.title = i + ' sao';
                btn.innerHTML = '<span>★</span>';
                btn.addEventListener('mouseover', function () {
                    const v = Number(this.dataset.value);
                    if (starFront) starFront.style.width = (v / 5 * 100) + '%';
                });
                btn.addEventListener('mouseout', function () {
                    setVisualAverage(avg);
                });
                btn.addEventListener('click', async function () {
                    const v = Number(this.dataset.value);
                    // require login
                    const token = localStorage.getItem('accessToken');
                    if (!token) return window.location.href = '/auth/login';
                    const storyId = ratingContainer.dataset.storyId;
                    try {
                        const res = await fetch(`/stories/${encodeURIComponent(storyId)}/rating`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ rating: v })
                        });
                        if (!res.ok) {
                            const txt = await res.text();
                            console.warn('Submit rating failed', res.status, txt);
                            alert('Không thể gửi đánh giá.');
                            return;
                        }
                        const json = await res.json();
                        // expected { average: number, count: number } (avg may be on 10-scale)
                        let newAvg = json.average ?? json.avg ?? json.rating ?? null;
                        const newCount = json.count ?? json.total ?? null;
                        if (newAvg !== null && newAvg !== undefined) {
                            if (newAvg > 5) newAvg = newAvg / 2;
                            avg = Number(newAvg);
                        }
                        if (newCount !== null && newCount !== undefined) {
                            if (countEl) countEl.textContent = newCount + ' lượt đánh giá';
                        }
                        setVisualAverage(avg);
                        // highlight user selection
                        try { highlightUserRating(v); } catch(e) {}
                        alert('Cảm ơn bạn đã đánh giá!');
                    } catch (e) {
                        console.error('Error submitting rating', e);
                        alert('Lỗi khi gửi đánh giá');
                    }
                });
                interactiveHolder.appendChild(btn);
            }

            // helper: highlight user's rating (fill selected buttons up to value)
            function highlightUserRating(val) {
                const buttons = Array.from(interactiveHolder.querySelectorAll('.star-btn'));
                buttons.forEach(b => {
                    const v = Number(b.dataset.value);
                    if (v <= val) b.classList.add('selected'); else b.classList.remove('selected');
                });
            }

            // If user is logged in, fetch their existing rating and update UI
            (async function fetchMyRating(){
                try {
                    const token = localStorage.getItem('accessToken');
                    if (!token) return; // not logged in
                    const storyId = ratingContainer.dataset.storyId;
                    const resp = await fetch(`/stories/${encodeURIComponent(storyId)}/rating`, { headers: { 'Authorization': 'Bearer ' + token } });
                    if (!resp.ok) return;
                    const j = await resp.json();
                    if (j.average !== undefined && j.average !== null) {
                        let readAvg = j.average;
                        if (readAvg > 5) readAvg = readAvg / 2;
                        avg = Number(readAvg);
                        setVisualAverage(avg);
                    }
                    if (j.count !== undefined && j.count !== null) {
                        if (countEl) countEl.textContent = j.count + ' lượt đánh giá';
                    }
                    if (j.myRating) {
                        highlightUserRating(j.myRating);
                    }
                } catch (e) { console.warn('Could not fetch my rating', e); }
            })();
        }
    } catch (e) { console.warn('story rating init failed', e); }

})