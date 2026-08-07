/**
 * A simple direct logout function that works independently of other components
 * This ensures that even if there are issues with the main logout implementation,
 * the user can still reliably log out
 */
export function performSimpleLogout() {
  try {
    // 1. Clear all storage immediately
    localStorage.removeItem('guestUser');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    
    // 2. Attempt server logout (don't block on this)
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('Logout API call failed (continuing anyway):', error);
    });
    
    // 3. Immediate redirect to auth page
    window.location.href = "/auth";
  } catch (error) {
    console.error('Error during logout:', error);
    // Still redirect even if something fails
    window.location.href = "/auth";
  }
}