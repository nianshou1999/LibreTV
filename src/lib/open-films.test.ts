import { afterEach, expect, it, vi } from 'vitest';
import { isOpenFilmSource, OPEN_FILM_SOURCE, searchOpenFilms, openFilmDetail } from './open-films';
afterEach(() => vi.unstubAllEnvs());
it('only enables the exact declared adapter and never invents popular show results', () => {
  vi.stubEnv('ENABLE_OPEN_FILMS', 'true');
  expect(isOpenFilmSource(OPEN_FILM_SOURCE)).toBe(true);
  expect(isOpenFilmSource({ ...OPEN_FILM_SOURCE, url: 'http://127.0.0.1' })).toBe(false);
  expect(searchOpenFilms('大雄兔')).toHaveLength(1);
  expect(searchOpenFilms('Breaking Bad')).toEqual([]);
  expect(openFilmDetail('unknown')).toBeNull();
  vi.stubEnv('ENABLE_OPEN_FILMS', 'false');
  expect(isOpenFilmSource(OPEN_FILM_SOURCE)).toBe(false);
});
