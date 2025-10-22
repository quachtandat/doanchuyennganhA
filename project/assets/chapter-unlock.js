/**
 * Chapter Unlock System
 * Handles VIP chapter unlocking and balance display
 */

const API_BASE_URL = 'http://localhost:3000';

// Load user balance when page loads
document.addEventListener('DOMContentLoaded', async function () {
  await loadUserBalance();
});

/**
 * Load and display user's coin balance
 */
async function loadUserBalance() {
  const token = localStorage.getItem('accessToken');
  const balanceEl = document.getElementById('user-balance');

  if (!token || !balanceEl) return;

  try {
    const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      balanceEl.textContent = data.balance || 0;
    } else {
      balanceEl.textContent = '0';
      console.warn('Failed to load balance:', response.status);
    }
  } catch (error) {
    console.error('Error loading balance:', error);
    balanceEl.textContent = '0';
  }
}

/**
 * Unlock a VIP chapter
 */
async function unlockChapter() {
  const token = localStorage.getItem('accessToken');

  // Check if user is logged in
  if (!token) {
    showAlert('Vui lòng đăng nhập để mua chương', 'warning');
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 1500);
    return;
  }

  // Get chapter ID from page
  const chapterId = getChapterIdFromURL();
  if (!chapterId) {
    showAlert('Không tìm thấy ID chương', 'danger');
    return;
  }

  const unlockBtn = document.getElementById('unlock-btn');
  const originalHTML = unlockBtn.innerHTML;

  // Disable button and show loading state
  unlockBtn.disabled = true;
  unlockBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2"></span>
        Đang xử lý...
    `;

  try {
    const response = await fetch(`${API_BASE_URL}/wallet/unlock-chapter/${chapterId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok) {
      // Success - show message and reload page
      showAlert('✓ Mở khóa thành công! Đang tải lại trang...', 'success');

      // Update balance display if exists
      const balanceEl = document.getElementById('user-balance');
      if (balanceEl && data.newBalance !== undefined) {
        balanceEl.textContent = data.newBalance;
      }

      // Reload page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      // Error - show error message
      const errorMsg = data.message || 'Mở khóa thất bại. Vui lòng thử lại.';
      showAlert('✗ ' + errorMsg, 'danger');

      // Re-enable button
      unlockBtn.disabled = false;
      unlockBtn.innerHTML = originalHTML;
    }
  } catch (error) {
    console.error('Error unlocking chapter:', error);
    showAlert('✗ Lỗi kết nối. Vui lòng thử lại.', 'danger');

    // Re-enable button
    unlockBtn.disabled = false;
    unlockBtn.innerHTML = originalHTML;
  }
}

/**
 * Get chapter ID from current URL
 * URL format: /story/{storyId}/chapter/{chapterId}
 */
function getChapterIdFromURL() {
  const pathParts = window.location.pathname.split('/');
  const chapterIndex = pathParts.indexOf('chapter');

  if (chapterIndex !== -1 && pathParts.length > chapterIndex + 1) {
    return pathParts[chapterIndex + 1];
  }

  return null;
}

/**
 * Show alert message
 */
function showAlert(message, type) {
  // Remove any existing alerts
  const existingAlerts = document.querySelectorAll('.alert-custom');
  existingAlerts.forEach(alert => alert.remove());

  // Create new alert
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-custom alert-dismissible fade show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

  document.body.appendChild(alertDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}