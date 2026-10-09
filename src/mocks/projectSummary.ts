import { DirectionSchema, ProjectSummarySchema, type Project } from '../../packages/contracts/src'
import { solaraProjectFixture } from './fixtures'

const owner = solaraProjectFixture.owner
const createdAt = solaraProjectFixture.createdAt
export const coldIndustrialFixture = DirectionSchema.parse({
  id: '00000000-0000-4000-8000-000000000030', projectId: solaraProjectFixture.id,
  name: 'Cold Industrial', description: 'Precise, technical product imagery with cool industrial materials.',
  status: 'ACTIVE', isActive: true, revisionCount: 1,
  latestRevision: {
    id: '00000000-0000-4000-8000-000000000031', directionId: '00000000-0000-4000-8000-000000000030', revisionNumber: 1,
    summary: 'Cool industrial product imagery with hard light, polished materials, and a precise premium mood.',
    palette: [{ name: 'steel blue', hex: null, role: null }, { name: 'graphite', hex: null, role: null }, { name: 'cool white', hex: null, role: null }],
    lighting: { quality: 'hard, high contrast', direction: 'directional', temperature: 'cool', notes: null },
    composition: { framing: null, layout: null, notes: null },
    materials: ['metal', 'glass', 'polished surfaces'], mood: ['precise', 'technical', 'premium'],
    typography: { families: [], notes: null }, requiredAttributes: [], forbiddenAttributes: [], stylePrompt: null, changeSummary: null,
    createdBy: owner, createdAt,
  }, createdBy: owner, createdAt, updatedAt: createdAt, archivedAt: null,
})

// These are mock-server response fixtures, never business rules computed by UI components.
export function summaryForProject(project: Project) {
  const isSolara = project.id === solaraProjectFixture.id
  return ProjectSummarySchema.parse({
    project,
    activeDirection: isSolara ? { direction: coldIndustrialFixture, revision: coldIndustrialFixture.latestRevision } : null,
    assetCounts: { total: isSolara ? 4 : 0, byStatus: { DRAFT: isSolara ? 1 : 0, IN_PROGRESS: 0, NEEDS_REVIEW: 0, APPROVED: isSolara ? 3 : 0, REJECTED: 0, ARCHIVED: 0 } },
    unresolvedRecommendationCount: 0, staleCollectionItemCount: 0, latestAssessment: null, recentDecisions: [],
  })
}
export const solaraSummaryFixture = summaryForProject(solaraProjectFixture)
