/** Resolve the SiriusX-owned electron-updater feed without DeepSeek COS settings. */

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {NodeJS.Platform} platform
 * @param {string} arch
 * @returns {{ environment: 'production', channel: 'nightly'|'stable', target: string, origin: string, keyPrefix: string, binaryKeyPrefix: string, publicUrl: string } | undefined}
 */
export function resolveSiriusxUpdateConfig(env, platform, arch) {
  const raw = env.SIRIUSX_UPDATE_URL?.trim()
  if (raw === undefined || raw === '') return undefined
  let parsed
  try { parsed = new URL(raw) }
  catch { throw new Error('SIRIUSX_UPDATE_URL must be an absolute URL') }
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('SIRIUSX_UPDATE_URL must use https (http is allowed only for localhost)')
  }
  const channel = env.SIRIUSX_UPDATE_CHANNEL === 'nightly' ? 'nightly' : 'stable'
  const target = platform === 'darwin' ? `mac-${arch}` : `win-${arch}`
  return {
    environment: 'production', channel, target, origin: parsed.origin,
    keyPrefix: '', binaryKeyPrefix: '',
    publicUrl: raw.endsWith('/') ? raw : `${raw}/`,
  }
}
