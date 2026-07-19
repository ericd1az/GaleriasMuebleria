const ADMIN_ACCESS_KEY = 'lh_admin_access_verified';

export function markAdminAccessVerified() {
  localStorage.setItem(ADMIN_ACCESS_KEY, 'true');
}

export function clearAdminAccessVerified() {
  localStorage.removeItem(ADMIN_ACCESS_KEY);
}

export function hasAdminAccessVerified() {
  return localStorage.getItem(ADMIN_ACCESS_KEY) === 'true';
}
