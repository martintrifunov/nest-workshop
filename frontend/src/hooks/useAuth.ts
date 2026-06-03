import { AuthUser } from '../types';

export function useAuth(): { user: AuthUser | null; token: string | null } {
  const token = localStorage.getItem('access_token');
  if (!token) return { user: null, token: null };

  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as AuthUser;
    return { user: payload, token };
  } catch {
    return { user: null, token: null };
  }
}
