/**
 * Enterprise resource decoding: the facts a packaged deployment injects and
 * the failure posture of each one.
 *
 * `bundles` and the IdP endpoint paths are file-only or env-overridable by
 * design, and the difference matters: a user override for `bundles` could add
 * code to a profile the deployment owns.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  enterpriseHostEnvironment,
  enterpriseTrustedOrigins,
  loadEnterpriseConfig,
} from '../src/enterprise.ts'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

/**
 * Write one enterprise resource into a fresh directory.
 * @param contents - exact file body.
 * @returns the directory holding `enterprise.json`.
 */
function resourceDir(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-enterprise-'))
  directories.push(directory)
  writeFileSync(join(directory, 'enterprise.json'), contents)
  return directory
}

describe('loadEnterpriseConfig', () => {
  it('reads the bundles a deployment mounts', () => {
    const directory = resourceDir(JSON.stringify({
      enabled: true,
      bundles: ['@siriusx/dsh-account-sso', '@siriusx/dsh-llm-siriusx'],
    }))
    const config = loadEnterpriseConfig(directory, {})
    // Order is the mount order, so it must survive decoding.
    expect(config.bundles).toEqual(['@siriusx/dsh-account-sso', '@siriusx/dsh-llm-siriusx'])
  })

  it('drops blank and non-string bundle names instead of mounting junk', () => {
    const directory = resourceDir(JSON.stringify({ enabled: true, bundles: ['a', '', 7, null, 'b'] }))
    expect(loadEnterpriseConfig(directory, {}).bundles).toEqual(['a', 'b'])
  })

  it('reports no bundles for an absent or empty list', () => {
    expect(loadEnterpriseConfig(resourceDir(JSON.stringify({ enabled: true })), {}).bundles).toBeUndefined()
    expect(loadEnterpriseConfig(resourceDir(JSON.stringify({ enabled: true, bundles: [] })), {}).bundles).toBeUndefined()
  })

  it('ignores a launch-time bundles override', () => {
    const directory = resourceDir(JSON.stringify({ enabled: true, bundles: ['from-file'] }))
    // Unlike scalars, bundles has no env escape: only the packaged resource
    // decides which code a deployment mounts.
    expect(loadEnterpriseConfig(directory, { SIRIUSX_BUNDLES: '["from-env"]' }).bundles).toEqual(['from-file'])
  })

  it('reads the IdP endpoint paths', () => {
    const directory = resourceDir(JSON.stringify({
      enabled: true,
      ssoAuthorizePath: '/realms/example/protocol/openid-connect/auth',
      ssoTokenPath: '/realms/example/protocol/openid-connect/token',
    }))
    const config = loadEnterpriseConfig(directory, {})
    expect(config.ssoAuthorizePath).toBe('/realms/example/protocol/openid-connect/auth')
    expect(config.ssoTokenPath).toBe('/realms/example/protocol/openid-connect/token')
  })

  it('projects the IdP endpoint paths into the Host environment', () => {
    const directory = resourceDir(JSON.stringify({
      enabled: true,
      ssoAuthorizePath: '/auth',
      ssoTokenPath: '/token',
    }))
    const env = enterpriseHostEnvironment(loadEnterpriseConfig(directory, {}), {})
    // The SSO plugin reads these from the Host environment, not from the file.
    expect(env.SIRIUSX_SSO_AUTHORIZE_PATH).toBe('/auth')
    expect(env.SIRIUSX_SSO_TOKEN_PATH).toBe('/token')
  })

  it('fails closed into enterprise mode when the resource is unreadable', () => {
    const directory = resourceDir('{ not json')
    expect(loadEnterpriseConfig(directory, {}).enabled).toBe(true)
  })
})

describe('enterpriseTrustedOrigins', () => {
  it('trusts the issuer origin so a LAN IdP can sign users in', () => {
    // A deployment without TLS on its IdP would otherwise be unable to open
    // the login browser at all.
    const directory = resourceDir(JSON.stringify({
      enabled: true,
      ssoIssuer: 'http://192.168.14.39:8081/realms/siriusx',
    }))
    expect(enterpriseTrustedOrigins(loadEnterpriseConfig(directory, {}))).toEqual(['http://192.168.14.39:8081'])
  })

  it('trusts nothing outside enterprise mode', () => {
    const directory = resourceDir(JSON.stringify({ enabled: false, ssoIssuer: 'http://idp.example' }))
    expect(enterpriseTrustedOrigins(loadEnterpriseConfig(directory, {}))).toEqual([])
  })

  it('trusts nothing when the issuer is absent or malformed', () => {
    expect(enterpriseTrustedOrigins({ enabled: true })).toEqual([])
    expect(enterpriseTrustedOrigins({ enabled: true, ssoIssuer: 'not a url' })).toEqual([])
  })
})
