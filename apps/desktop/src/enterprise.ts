/** SiriusX enterprise deployment configuration and Host environment projection. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface EnterpriseConfig {
  readonly enabled: boolean
  readonly ssoIssuer?: string
  readonly ssoClientId?: string
  readonly ssoJwksUri?: string
  readonly ssoTenantClaim?: string
  /** IdP authorization endpoint path, when the issuer root does not serve it. */
  readonly ssoAuthorizePath?: string
  /** IdP token endpoint path, when the issuer root does not serve it. */
  readonly ssoTokenPath?: string
  readonly modelGatewayUrl?: string
  readonly controlPlaneUrl?: string
  readonly enterpriseModelProvider?: string
  readonly botApiUrl?: string
  /**
   * Additional profile bundles mounted after the web template. Each must
   * already resolve from the installation tree; this selects, it does not
   * install.
   */
  readonly bundles?: readonly string[]
  readonly bundledPluginsDir?: string
}

const ENV_KEYS = {
  enabled: 'SIRIUSX_ENTERPRISE',
  ssoIssuer: 'SIRIUSX_SSO_ISSUER',
  ssoClientId: 'SIRIUSX_SSO_CLIENT_ID',
  ssoJwksUri: 'SIRIUSX_SSO_JWKS_URI',
  ssoTenantClaim: 'SIRIUSX_SSO_TENANT_CLAIM',
  ssoAuthorizePath: 'SIRIUSX_SSO_AUTHORIZE_PATH',
  ssoTokenPath: 'SIRIUSX_SSO_TOKEN_PATH',
  modelGatewayUrl: 'SIRIUSX_MODEL_GATEWAY_URL',
  controlPlaneUrl: 'SIRIUSX_CONTROL_PLANE_URL',
  enterpriseModelProvider: 'SIRIUSX_ENTERPRISE_MODEL_PROVIDER',
  botApiUrl: 'SIRIUSX_BOT_API_URL',
  bundledPluginsDir: 'SIRIUSX_BUNDLED_PLUGINS_DIR',
} as const

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Read the extra bundle names a deployment mounts.
 *
 * Only the packaged resource names bundles; a launch-time env override would
 * let a user add code to a profile the deployment owns, so `bundles` stays a
 * file-only setting while every scalar above keeps its env escape.
 * @param value - raw `bundles` member of the enterprise resource.
 * @returns the listed names, in declaration order.
 */
function bundleList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const names = value.filter((name): name is string => typeof name === 'string' && name.trim() !== '')
  return names.length === 0 ? undefined : names
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
  // Keycloak serves its endpoints beneath the realm path, not at the issuer
  // root, so a deployment that names only the issuer would fail every login.
  const ssoAuthorizePath = pick(ENV_KEYS.ssoAuthorizePath, 'ssoAuthorizePath')
  const ssoTokenPath = pick(ENV_KEYS.ssoTokenPath, 'ssoTokenPath')
  const modelGatewayUrl = pick(ENV_KEYS.modelGatewayUrl, 'modelGatewayUrl')
  const controlPlaneUrl = pick(ENV_KEYS.controlPlaneUrl, 'controlPlaneUrl')
  const enterpriseModelProvider = pick(ENV_KEYS.enterpriseModelProvider, 'enterpriseModelProvider')
  const botApiUrl = pick(ENV_KEYS.botApiUrl, 'botApiUrl')
  const bundles = bundleList(file.bundles)
  const bundledPluginsDir = pick(ENV_KEYS.bundledPluginsDir, 'bundledPluginsDir')
  return {
    enabled,
    ...(ssoIssuer === undefined ? {} : { ssoIssuer }),
    ...(ssoClientId === undefined ? {} : { ssoClientId }),
    ...(ssoJwksUri === undefined ? {} : { ssoJwksUri }),
    ...(ssoTenantClaim === undefined ? {} : { ssoTenantClaim }),
    ...(ssoAuthorizePath === undefined ? {} : { ssoAuthorizePath }),
    ...(ssoTokenPath === undefined ? {} : { ssoTokenPath }),
    ...(modelGatewayUrl === undefined ? {} : { modelGatewayUrl }),
    ...(controlPlaneUrl === undefined ? {} : { controlPlaneUrl }),
    ...(enterpriseModelProvider === undefined ? {} : { enterpriseModelProvider }),
    ...(botApiUrl === undefined ? {} : { botApiUrl }),
    ...(bundles === undefined ? {} : { bundles }),
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
    ...(config.ssoAuthorizePath === undefined ? {} : { SIRIUSX_SSO_AUTHORIZE_PATH: config.ssoAuthorizePath }),
    ...(config.ssoTokenPath === undefined ? {} : { SIRIUSX_SSO_TOKEN_PATH: config.ssoTokenPath }),
    ...(config.modelGatewayUrl === undefined ? {} : { SIRIUSX_MODEL_GATEWAY_URL: config.modelGatewayUrl }),
    ...(config.controlPlaneUrl === undefined ? {} : { SIRIUSX_CONTROL_PLANE_URL: config.controlPlaneUrl }),
    ...(config.enterpriseModelProvider === undefined ? {} : { SIRIUSX_ENTERPRISE_MODEL_PROVIDER: config.enterpriseModelProvider }),
    ...(config.botApiUrl === undefined ? {} : { SIRIUSX_BOT_API_URL: config.botApiUrl }),
    ...(config.bundledPluginsDir === undefined ? {} : { SIRIUSX_BUNDLED_PLUGINS_DIR: config.bundledPluginsDir }),
  }
}

/**
 * Origins the login browser may be sent to over plain HTTP.
 *
 * An internal IdP on a LAN address has no TLS, and refusing it would make
 * enterprise sign-in impossible without a certificate the deployment does not
 * have. Only the configured issuer origin is trusted; nothing else gains
 * plain-HTTP navigation.
 * @param config - enterprise facts.
 * @returns the issuer origin in enterprise mode, otherwise none.
 */
export function enterpriseTrustedOrigins(config: EnterpriseConfig): readonly string[] {
  if (!config.enabled || config.ssoIssuer === undefined) return []
  try {
    return [new URL(config.ssoIssuer).origin]
  } catch {
    return []
  }
}
