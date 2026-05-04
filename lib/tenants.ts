import { prisma } from './db'

export interface TenantConfig {
  tenantId: string
  name: string
  tunnelSubdomain: string
  bcInstance: string
  bcCompany: string
  apiKey: string
  agentBaseUrl: string
  entityConfig: Record<string, boolean> | null
  country: string
}

export async function getTenantById(tenantId: string): Promise<TenantConfig | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId, active: true },
    select: {
      id: true, name: true, tunnelSubdomain: true,
      bcInstance: true, bcCompany: true, apiKey: true,
      entityConfig: true, country: true,
    },
  })
  if (!tenant) return null
  return mapTenant(tenant)
}

export async function getTenantBySubdomain(
  subdomain: string,
): Promise<TenantConfig | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { tunnelSubdomain: subdomain, active: true },
  })
  if (!tenant) return null
  return mapTenant(tenant)
}

function mapTenant(tenant: {
  id: string
  name: string
  tunnelSubdomain: string
  bcInstance: string
  bcCompany: string
  apiKey: string
  entityConfig?: any
}): TenantConfig {
  return {
    tenantId: tenant.id,
    name: tenant.name,
    tunnelSubdomain: tenant.tunnelSubdomain,
    bcInstance: tenant.bcInstance,
    bcCompany: tenant.bcCompany,
    apiKey: tenant.apiKey,
    agentBaseUrl: `https://${tenant.tunnelSubdomain}-agent.bespoxai.com`,
    entityConfig: (tenant.entityConfig as Record<string, boolean> | null) ?? null,
    country:      (tenant as any).country ?? 'NZ',
  }
}

/**
 * Build a full OData URL for a given entity + optional query params.
 * e.g. buildODataUrl(tenant, 'Customer', '$top=10&$filter=...')
 */
export function buildODataUrl(
  tenant: TenantConfig,
  entity: string,
  params?: string,
): string {
  const base = `${tenant.agentBaseUrl}/${tenant.bcInstance}/ODataV4/Company('${tenant.bcCompany}')/${entity}`
  return params ? `${base}?${params}` : base
}
