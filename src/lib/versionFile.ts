export function isVersionFileUrl(value: string) {
  const input = value.trim()
  try {
    const url = new URL(input, 'https://demo.invalid')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && (/^https?:\/\//i.test(input) || (input.startsWith('/demo-assets/') && url.origin === 'https://demo.invalid' && url.pathname.startsWith('/demo-assets/')))
  } catch { return false }
}
