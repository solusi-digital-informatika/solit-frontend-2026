import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ApiClientError, type ApiClient } from './lib/api/client'
import { healthFixture } from './mocks/fixtures'

function testClient(health: ApiClient['health']): ApiClient {
  return { health, request: vi.fn() }
}
describe('boot handshake', () => {
  it('shows loading until the validated health response arrives', async () => {
    let resolve!: (value: typeof healthFixture) => void
    render(<App client={testClient(() => new Promise(done => { resolve = done }))} isMockApi />)
    expect(screen.getByText('Checking API compatibility…')).toBeInTheDocument()
    resolve(healthFixture)
    expect(await screen.findByText('Integration foundation ready')).toBeInTheDocument()
    expect(screen.getByText('Mock API enabled')).toBeInTheDocument()
  })
  it('blocks incompatible major versions', async () => {
    render(<App client={testClient(async () => ({ data: { ...healthFixture.data, contractVersion: '2.0.0' } }))} isMockApi={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('incompatible')
    expect(screen.queryByText('Integration foundation ready')).not.toBeInTheDocument()
  })
  it('shows a request ID and retries a failed handshake', async () => {
    const health = vi.fn<ApiClient['health']>().mockRejectedValueOnce(new ApiClientError('Connection failed.', { code: 'NETWORK_ERROR', requestId: 'copyable-id' })).mockResolvedValue(healthFixture)
    render(<App client={testClient(health)} isMockApi />)
    expect(await screen.findByRole('alert')).toHaveTextContent('copyable-id')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Integration foundation ready')).toBeInTheDocument()
    expect(health).toHaveBeenCalledTimes(2)
  })
})
