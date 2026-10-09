export const activityCopy = {
  heading: 'Activity log', intro: 'Follow the recorded changes, reviews and human decisions in this project.',
  loading: 'Loading activity…', empty: 'No activity recorded yet.', noResults: 'No activity matches these filters.',
  retry: 'Try again', refresh: 'Refresh activity', more: 'Load more activity', requestId: 'Request ID', all: 'All events',
  event: 'Event type', from: 'From (local time)', to: 'To (local time)', actor: 'Actor ID', entityType: 'Entity type', entityId: 'Entity ID',
  apply: 'Apply filters', clear: 'Clear filters', invalidDate: 'Choose a valid date range with the start before the end.', invalidId: 'Use valid UUIDs for actor and entity IDs.',
  exportHeading: 'Export project', exportIntro: 'Download project records. JSON includes historical versions and exact collection pins; Markdown provides a report; CSV lists assets and their latest versions.',
  format: 'Export format', create: 'Create export', creating: 'Creating export…', download: 'Download export',
  failedWrite: 'Export requests are not retried automatically. You can create a new export after checking your connection.',
  warnings: 'Export warnings', ready: 'Export ready. Review the warnings, then download the file.',
  system: 'System', unknown: 'Other activity',
} as const
export function eventLabel(value: string) {
  if (!Object.hasOwn(eventLabels, value)) return activityCopy.unknown
  return eventLabels[value as keyof typeof eventLabels]
}
export const eventLabels = {
  PROJECT_CREATED: 'Project created', PROJECT_UPDATED: 'Project updated', PROJECT_ARCHIVED: 'Project archived', PROJECT_RESTORED: 'Project restored',
  BRIEF_REVISION_CREATED: 'Brief revision created', DIRECTION_CREATED: 'Direction created', DIRECTION_REVISION_CREATED: 'Direction revision created', ACTIVE_DIRECTION_CHANGED: 'Active direction changed',
  REFERENCE_ADDED: 'Reference added', REFERENCE_UPDATED: 'Reference updated', REFERENCE_LINKED: 'Reference linked', REFERENCE_ATTRIBUTE_REVIEWED: 'Reference attribute reviewed',
  ASSET_CREATED: 'Asset created', ASSET_UPDATED: 'Asset updated', ASSET_VERSION_CREATED: 'Asset version created', ASSET_VERSION_STATUS_CHANGED: 'Asset version status changed',
  ASSESSMENT_STARTED: 'Assessment started', ASSESSMENT_COMPLETED: 'Assessment completed', ASSESSMENT_FAILED: 'Assessment failed', ASSESSMENT_CANCELLED: 'Assessment cancelled', RECOMMENDATION_RESOLVED: 'Recommendation resolved',
  COLLECTION_CREATED: 'Collection created', COLLECTION_REVISION_CREATED: 'Collection revision created', COLLECTION_ITEM_PINNED: 'Collection item pinned', COLLECTION_ITEM_REPLACED: 'Collection item replaced', COLLECTION_SUBMITTED: 'Collection submitted', COLLECTION_APPROVED: 'Collection approved', COLLECTION_REVIEW_REJECTED: 'Collection review rejected', EXPORT_CREATED: 'Export created', DEMO_RESET: 'Demo reset',
} as const
