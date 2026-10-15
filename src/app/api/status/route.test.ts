import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { signSession, SESSION_COOKIE } from '@/lib/auth';

afterEach(() => vi.unstubAllEnvs());
describe('private configuration', () => {
  it('does not expose source credentials or subscriptions to an anonymous visitor', async () => {
    vi.stubEnv('PASSWORD', 'unit-test-password');
    vi.stubEnv('DEFAULT_SOURCES', JSON.stringify([{ name: 'private', url: 'https://source.example/api?key=secret' }]));
    vi.stubEnv('DEFAULT_SUBSCRIPTIONS', JSON.stringify(['https://source.example/private.json']));
    const response = await GET(new Request('https://local.test/api/status'));
    const body = await response.json();
    expect(body.verified).toBe(false);
    expect(body.defaultSources).toEqual([]);
    expect(body.defaultSubscriptions).toEqual([]);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('loads the opt-in licensed verification catalogue only after login', async () => {
    vi.stubEnv('PASSWORD', 'unit-test-password');
    vi.stubEnv('ENABLE_OPEN_FILMS', 'true');
    vi.stubEnv('DEFAULT_SOURCES', '[]');
    const { token } = signSession();
    const response = await GET(new Request('https://local.test/api/status', { headers: { cookie: `${SESSION_COOKIE}=${token}` } }));
    expect((await response.json()).defaultSources[0].key).toBe('open_films');
  });
});
