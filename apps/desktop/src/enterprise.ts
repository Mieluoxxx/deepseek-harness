/** SiriusX enterprise deployment configuration and Host environment projection. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface EnterpriseConfig {
  readonly enabled: boolean
  readonly ssoIssuer?: string
  readonly ssoClientId?: string
  readonly ssoJwksUri?: string
  readonly ssoTenantClaim?: string
  readonly modelGatewayUrl?: string
  readonly botApiUrl?: string
  readonly bundledPluginsDir?: string
}

const ENV_KEYS = {
  enabled: 'SIRIUSX_ENTERPRISE',
  ssoIssuer: 'SIRIUSX_SSO_ISSUER',
  ssoClientId: 'SIRIUSX_SSO_CLIENT_ID',
  ssoJwksUri: 'SIRIUSX_SSO_JWKS_URI',
  ssoTenantClaim: 'SIRIUSX_SSO_TENANT_CLAIM',
  modelGatewayUrl: 'SIRIUSX_MODEL_GATEWAY_URL',
  botApiUrl: 'SIRIUSX_BOT_API_URL',
  bundledPluginsDir: 'SIRIUSX_BUNDLED_PLUGINS_DIR',
} as const

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Read enterprise settings from the packaged resource, with launch-time env
 * overrides for development and private deployments.
 * @param resourcesPath - Electron resources directory (default: process.resourcesPath).
 * @param env - launch env; defaults to process.env.
 * @returns validated enterprise mode facts; an absent resource means personal mode.
 */
export function loadEnterpriseConfig(
  resourcesPath: string = process.resourcesPath,
  env: NodeJS.ProcessEnv = process.env,
): EnterpriseConfig {
  let file: Record<string, unknown> = {}
  const path = join(resourcesPath, 'enterprise.json')
  if (existsSync(path)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) file = parsed as Record<string, unknown>
    } catch {
      // Invalid enterprise configuration must fail closed into enterprise mode
      // with no usable SSO settings, rather than silently becoming personal.
      file = { enabled: true }
    }
  }
  const enabled = env[ENV_KEYS.enabled] === '1' || env[ENV_KEYS.enabled] === 'true' || file.enabled === true
  const pick = (envKey: string, fileKey: string): string | undefined =>
    stringValue(env[envKey]) ?? stringValue(file[fileKey])
  const ssoIssuer = pick(ENV_KEYS.ssoIssuer, 'ssoIssuer')
  const ssoClientId = pick(ENV_KEYS.ssoClientId, 'ssoClientId')
  const ssoJwksUri = pick(ENV_KEYS.ssoJwksUri, 'ssoJwksUri')
  const ssoTenantClaim = pick(ENV_KEYS.ssoTenantClaim, 'ssoTenantClaim')
  const modelGatewayUrl = pick(ENV_KEYS.modelGatewayUrl, 'modelGatewayUrl')
  const botApiUrl = pick(ENV_KEYS.botApiUrl, 'botApiUrl')
  const bundledPluginsDir = pick(ENV_KEYS.bundledPluginsDir, 'bundledPluginsDir')
  return {
    enabled,
    ...(ssoIssuer === undefined ? {} : { ssoIssuer }),
    ...(ssoClientId === undefined ? {} : { ssoClientId }),
    ...(ssoJwksUri === undefined ? {} : { ssoJwksUri }),
    ...(ssoTenantClaim === undefined ? {} : { ssoTenantClaim }),
    ...(modelGatewayUrl === undefined ? {} : { modelGatewayUrl }),
    ...(botApiUrl === undefined ? {} : { botApiUrl }),
    ...(bundledPluginsDir === undefined ? {} : { bundledPluginsDir }),
  }
}

/** Project enterprise facts into the private Host child environment. */
export function enterpriseHostEnvironment(config: EnterpriseConfig, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...env,
    SIRIUSX_ENTERPRISE: config.enabled ? '1' : '0',
    ...(config.ssoIssuer === undefined ? {} : { SIRIUSX_SSO_ISSUER: config.ssoIssuer }),
    ...(config.ssoClientId === undefined ? {} : { SIRIUSX_SSO_CLIENT_ID: config.ssoClientId }),
    ...(config.ssoJwksUri === undefined ? {} : { SIRIUSX_SSO_JWKS_URI: config.ssoJwksUri }),
    ...(config.ssoTenantClaim === undefined ? {} : { SIRIUSX_SSO_TENANT_CLAIM: config.ssoTenantClaim }),
    ...(config.modelGatewayUrl === undefined ? {} : { SIRIUSX_MODEL_GATEWAY_URL: config.modelGatewayUrl }),
    ...(config.botApiUrl === undefined ? {} : { SIRIUSX_BOT_API_URL: config.botApiUrl }),
    ...(config.bundledPluginsDir === undefined ? {} : { SIRIUSX_BUNDLED_PLUGINS_DIR: config.bundledPluginsDir }),
  }
}
