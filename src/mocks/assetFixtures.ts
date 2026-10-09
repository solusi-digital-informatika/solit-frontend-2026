import { AssetSchema, AssetVersionSummarySchema } from '../../packages/contracts/src'
import { solaraProjectFixture as project } from './fixtures'
const definitions = [ ['050', 'Hero Product Reveal', 'HERO_IMAGE', 'APPROVED', ['060', '061']], ['051', 'Product Close-up', 'PRODUCT_IMAGE', 'APPROVED', ['062']], ['052', 'Factory Background', 'BACKGROUND', 'APPROVED', ['063']], ['053', 'Metal Texture Detail', 'TEXTURE', 'DRAFT', ['064']] ] as const
const uuid = (suffix: string) => `00000000-0000-4000-8000-000000000${suffix}`
const files: Record<string, string> = { '060': 'hero-v1', '061': 'hero-v2', '062': 'closeup-v1', '063': 'factory-bg-v1', '064': 'metal-texture-v1' }
export const assetTargetFixtures = definitions.map(([suffix, title, assetType, status, versionIds]) => {
  const assetId = uuid(suffix)
  const versions = versionIds.map((value, index) => AssetVersionSummarySchema.parse({ id: uuid(value), assetId, versionNumber: index + 1, status: value === '060' ? 'SUPERSEDED' : value === '064' ? 'CANDIDATE' : 'APPROVED', thumbnailUrl: `/demo-assets/${files[value]}.jpg`, createdAt: project.createdAt })).reverse()
  const asset = AssetSchema.parse({ id: assetId, projectId: project.id, title, description: 'Fictional Solara demo artwork; procedurally drawn placeholder.', assetType, status, tags: [], owner: project.owner, versionCount: versions.length, latestVersion: versions[0], createdBy: project.owner, createdAt: project.createdAt, updatedAt: project.updatedAt, archivedAt: null })
  return { asset, versions }
})
