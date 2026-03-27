$(document).ready(function () {
    // Story page: render interactive 5-star rating and submit to server
    try {
        const ratingContainer = document.getElementById('story-rating');
        if (!ratingContainer) return;

        // inject interactive star buttons (1..5)
        const interactiveHolder = ratingContainer.querySelector('.star-interactive');
        const starDisplay = document.getElementById('star-display');
        const avgEl = document.getElementById('story-rating-average');
        const countEl = document.getElementById('story-rating-count');

        const origAvgRaw = parseFloat(ratingContainer.dataset.originalAverage) || 0;
        let avg = origAvgRaw;
        // if original scale is out of 5 (e.g., out of 10), normalize: if >5 assume it's out of 10
        if (origAvgRaw > 5) avg = origAvgRaw / 2;
        let count = parseInt(ratingContainer.dataset.count) || 0;

        function updateDisplay(newAvg, newCount) {
            if (avgEl) avgEl.textContent = (Math.round(newAvg * 10) / 10).toFixed(1);
            if (countEl) countEl.textContent = newCount;
            updateStarDisplay(newAvg);
        }

        function updateStarDisplay(rating) {
            const fullStars = Math.floor(rating);
            const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
            if (starDisplay) starDisplay.textContent = stars;
        }

        updateDisplay(avg, count);

        // create star buttons
        if (interactiveHolder) {
            for (let i = 1; i <= 5; i++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'star-btn';
                btn.dataset.value = i;
                btn.title = i + ' sao';
                btn.innerHTML = '★';
                
                btn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    const ratingValue = Number(this.dataset.value);
                    
                    // require login
                    const token = localStorage.getItem('accessToken');
                    if (!token) return window.location.href = '/auth/login';
                    
                    const storyId = ratingContainer.dataset.storyId;
                    try {
                        const res = await fetch(`/stories/${encodeURIComponent(storyId)}/rating`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ rating: ratingValue })
                        });
                        
                        if (!res.ok) {
                            const txt = await res.text();
                            console.warn('Submit rating failed', res.status, txt);
                            showThankYouModal('Lỗi', 'Không thể gửi đánh giá.');
                            return;
                        }
                        
                        const json = await res.json();
                        let newAvg = json.average ?? json.avg ?? json.rating ?? avg;
                        const newCount = json.count ?? json.total ?? count;
                        
                        if (newAvg > 5) newAvg = newAvg / 2;
                        avg = Number(newAvg);
                        count = newCount;
                        
                        updateDisplay(avg, count);
                        showThankYouModal('Cảm ơn!', 'Cảm ơn bạn đã đánh giá!');
                        hideRatingButtons();
                    } catch (e) {
                        console.error('Error submitting rating', e);
                        showThankYouModal('Lỗi', 'Lỗi khi gửi đánh giá');
                    }
                });
                
                interactiveHolder.appendChild(btn);
            }

            // Show rating buttons on hover/click of star display
            function showRatingButtons() {
                interactiveHolder.classList.add('active');
            }

            function hideRatingButtons() {
                interactiveHolder.classList.remove('active');
            }

            starDisplay.addEventListener('click', showRatingButtons);
            starDisplay.addEventListener('mouseover', showRatingButtons);
            
            // Hide buttons when mouse leaves rating container
            ratingContainer.addEventListener('mouseleave', hideRatingButtons);

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
                        updateDisplay(avg, count);
                    }
                    if (j.count !== undefined && j.count !== null) {
                        count = j.count;
                        countEl.textContent = count;
                    }
                } catch (e) { console.warn('Could not fetch my rating', e); }
            })();
        }
    } catch (e) { console.warn('story rating init failed', e); }

    // Helper function to show thank you modal
    function showThankYouModal(title, message) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('ratingModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ratingModal';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header border-0">
                            <h5 class="modal-title" id="ratingModalTitle"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <div id="ratingModalMessage"></div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Update and show
        document.getElementById('ratingModalTitle').textContent = title;
        document.getElementById('ratingModalMessage').innerHTML = message;
        const bsModal = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: true });
        bsModal.show();
    }

})