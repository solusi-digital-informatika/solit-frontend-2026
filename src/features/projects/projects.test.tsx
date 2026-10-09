import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { createHandlers } from '../../mocks/handlers'
import { solaraProjectFixture } from '../../mocks/fixtures'
import { ProjectSchema } from '../../../packages/contracts/src'
import { createApiClient, createIntentKey } from '../../lib/api/client'
import { projectApi } from './api'
import { Projects, ProjectStatus } from './Projects'

const base = 'http://localhost:3001/api/v1'
const server = setupServer()
const client = createApiClient(base)
const api = projectApi(client)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => { window.location.hash = '/projects'; server.resetHandlers(...createHandlers(base)) })
afterEach(() => { window.location.hash = '/projects' })
afterAll(() => server.close())

describe('projects mock contract', () => {
  it('uses the canonical Solara IDs and returns validated DTOs', async () => {
    expect(ProjectSchema.parse(solaraProjectFixture).activeDirectionRevisionId).toBe('00000000-0000-4000-8000-000000000031')
    expect((await api.list({})).data).toEqual([solaraProjectFixture])
    expect((await api.get(solaraProjectFixture.id)).data).toEqual(solaraProjectFixture)
  })
  it('creates blank projects and replays the same intent without duplication', async () => {
    const key = createIntentKey()
    const body = { name: 'New campaign', template: 'BLANK' as const }
    const first = await api.create(body, key)
    const second = await api.create(body, key)
    expect(first).toEqual(second)
    expect(first.data.id).not.toBe(solaraProjectFixture.id)
    expect(first.data.activeDirectionRevisionId).toBeNull()
    expect((await api.list({})).data).toHaveLength(2)
    await expect(api.create({ ...body, name: 'Different campaign' }, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  })
  it('validates names, reads, and query values', async () => {
    await expect(api.create({ name: ' ', template: 'BLANK' }, createIntentKey())).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'body.name' }] })
    await expect(api.get(crypto.randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.list({ status: 'INVALID' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
  it('filters on the mock server and supports opaque cursor pagination', async () => {
    await api.create({ name: 'Alpha', description: 'Special search term', template: 'BLANK' }, createIntentKey())
    expect((await api.list({ q: 'special' })).data.map(project => project.name)).toEqual(['Alpha'])
    expect((await api.list({ status: 'ARCHIVED' })).data).toEqual([])
    const first = await client.request('/projects', (await import('../../../packages/contracts/src')).ApiListSchema(ProjectSchema), { query: { limit: 1, sort: 'name:asc' } })
    expect(first.data[0].name).toBe('Alpha')
    const second = await client.request('/projects', (await import('../../../packages/contracts/src')).ApiListSchema(ProjectSchema), { query: { limit: 1, sort: 'name:asc', cursor: first.page.nextCursor! } })
    expect(second.data[0].id).toBe(solaraProjectFixture.id)
    expect(second.page.nextCursor).toBeNull()
  })
})

describe('project screens', () => {
  it('opens Solara and returns to the list', async () => {
    render(<Projects client={client} isMockApi />)
    expect(screen.getByText('Loading projects…')).toBeInTheDocument()
    await screen.findByRole('heading', { name: solaraProjectFixture.name })
    window.location.hash = `/projects/${solaraProjectFixture.id}`
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByText('Project opened')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: solaraProjectFixture.name })).toHaveFocus()
    window.location.hash = '/projects'
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })
  it('creates and opens one project despite duplicate submissions', async () => {
    let requests = 0
    server.events.on('request:start', ({ request }) => { if (request.method === 'POST') requests++ })
    render(<Projects client={client} isMockApi />)
    await screen.findByRole('heading', { name: solaraProjectFixture.name })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
    expect(screen.getByLabelText('Project name')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'My campaign' } })
    const form = screen.getByRole('form', { name: 'Create project' })
    fireEvent.submit(form); fireEvent.submit(form)
    expect(await screen.findByRole('heading', { name: 'My campaign' })).toBeInTheDocument()
    expect(requests).toBe(1)
    server.events.removeAllListeners()
  })
  it('preserves form input on network failure and offers resubmission', async () => {
    server.use(http.post(`${base}/projects`, () => HttpResponse.error()))
    render(<Projects client={client} isMockApi />)
    await screen.findByRole('heading', { name: solaraProjectFixture.name })
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Keep my draft' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the API')
    expect(screen.getByLabelText('Project name')).toHaveValue('Keep my draft')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })
  it('shows filtered no-results and a recoverable list error', async () => {
    render(<Projects client={client} isMockApi />)
    await screen.findByRole('heading', { name: solaraProjectFixture.name })
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'not present' } })
    expect(await screen.findByText('No projects match these filters.')).toBeInTheDocument()
    server.use(http.get(`${base}/projects`, () => HttpResponse.error()))
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: '' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID')
    server.resetHandlers(...createHandlers(base))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: solaraProjectFixture.name })).toBeInTheDocument()
  })
  it('renders an unknown status with text and an icon', () => {
    render(<ProjectStatus status="FUTURE_STATUS" />)
    expect(screen.getByText('Unknown status')).toBeInTheDocument()
    expect(screen.getByText('?')).toHaveAttribute('aria-hidden', 'true')
  })
  it('shows field validation before sending an empty name', async () => {
    render(<Projects client={client} isMockApi />)
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByText('Enter a project name between 1 and 160 characters.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Project name')).toHaveAttribute('aria-invalid', 'true'))
  })
})
