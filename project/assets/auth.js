/* eslint-disable prettier/prettier */

(function () {
  'use strict';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
  });

  // Check if user is logged in
  function checkAuthStatus() {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      // Verify token is still valid
      fetch('/auth/profile', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      })
        .then(function (response) {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error('Token invalid');
          }
        })
        .then(function (data) {
          showUserProfile(data);
        })
        .catch(function () {
          // Token is invalid, clear and show login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userData');
          showLoginButtons();
        });
    } else {
      showLoginButtons();
    }
  }

  // Show login buttons (hide user profile)
  function showLoginButtons() {
    const loginButtons = document.getElementById('login-buttons');
    const userProfile = document.getElementById('user-profile');

    if (loginButtons) {
      loginButtons.style.display = 'flex';
      loginButtons.style.setProperty('display', 'flex', 'important');
    }
    if (userProfile) {
      userProfile.style.display = 'none';
      userProfile.style.setProperty('display', 'none', 'important');
    }
  }

  // Show user profile (hide login buttons)
  function showUserProfile(userData) {
    const firstName = userData.name.split(' ')[0];
    const initials = userData.name.split(' ')
      .map(function (word) { return word.charAt(0).toUpperCase(); })
      .join('')
      .substring(0, 2);

    // HIDE login buttons, SHOW profile
    const loginButtons = document.getElementById('login-buttons');
    const userProfile = document.getElementById('user-profile');

    if (loginButtons) {
      loginButtons.style.display = 'none';
      loginButtons.style.setProperty('display', 'none', 'important');
    }
    if (userProfile) {
      userProfile.style.display = 'block';
      userProfile.style.setProperty('display', 'block', 'important');
    }

    // Update user information
    const userAvatar = document.getElementById('user-avatar');
    const userNameDisplay = document.getElementById('user-name-display');
    const userNameMenu = document.getElementById('user-name-menu');
    const userEmailMenu = document.getElementById('user-email-menu');
    const walletCoins = document.getElementById('wallet-coins');

    if (userAvatar) userAvatar.textContent = initials;
    if (userNameDisplay) userNameDisplay.textContent = firstName;
    if (userNameMenu) userNameMenu.textContent = userData.name;
    if (userEmailMenu) userEmailMenu.textContent = userData.email;
    if (walletCoins) walletCoins.textContent = userData.wallet_coins || 0;
  }

  // Handle logout
  window.handleLogout = function () {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userData');
      window.location.href = '/';
    }
  };

})();