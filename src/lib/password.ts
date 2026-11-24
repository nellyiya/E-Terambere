// The same rules the server enforces (the server has the final say). Shown live so people know what is missing.
const WORDS = ['password', 'qwerty', '123456', 'admin', 'letmein', 'welcome', 'eterambere', 'terambere']
const LEET: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }
export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e.trim())
export const checks = (pw: string, email = ''): [string, boolean][] => {
  const low = pw.toLowerCase(), plain = [...low].map(c => LEET[c] ?? c).join(''), local = email.split('@')[0].toLowerCase()
  return [['At least 12 characters', pw.length >= 12], ['A lowercase letter', /[a-z]/.test(pw)], ['An uppercase letter', /[A-Z]/.test(pw)], ['A number', /\d/.test(pw)], ['A symbol such as ! @ # ?', /[^A-Za-z0-9]/.test(pw)],
    ['No character repeated 3 times in a row', !/(.)\1{2,}/i.test(pw) && !/^(.{3,}?)\1+$/.test(pw)], ['No common words like "password" or "admin"', !WORDS.some(w => low.includes(w) || plain.includes(w))], ['Does not contain your email name', !(local.length >= 4 && low.includes(local))]]
}
