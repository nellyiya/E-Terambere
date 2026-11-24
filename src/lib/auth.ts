// The sign-in token lives in sessionStorage: it is cleared when the browser or tab is closed, and never stored on disk.
const KEY = 'eterambere.token'
export const getToken = (): string | null => { try { return sessionStorage.getItem(KEY) } catch { return null } }
export const setToken = (t: string) => { try { sessionStorage.setItem(KEY, t) } catch { /* storage blocked: the session just won't survive a reload */ } }
export const clearToken = () => { try { sessionStorage.removeItem(KEY) } catch { /* nothing to clear */ } }
