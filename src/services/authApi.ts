import { authClient } from '../lib/api'
import { setToken } from '../lib/auth'
export const login = async (email: string, password: string) => { const { data } = await authClient.post('/login', { email, password }); setToken(data.access_token) }
export const refreshToken = async () => { const { data } = await authClient.post('/refresh'); setToken(data.access_token) }
export const changePassword = async (current: string, next: string) => { const { data } = await authClient.post('/change-password', { current_password: current, new_password: next }); setToken(data.access_token) }
