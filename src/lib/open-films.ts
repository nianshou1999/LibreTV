import type { SourceConfig, SearchResultItem, VideoDetail } from './types';

// A small local adapter for an explicitly licensed verification film, not a CMS API.
// License: https://peach.blender.org/about/ (CC BY 3.0).
// Stream listed by its operator at https://test-streams.mux.dev/.
export const OPEN_FILM_SOURCE: SourceConfig = {
  key: 'open_films',
  name: '开放授权验收影片（非美剧片库）',
  url: 'https://test-streams.mux.dev',
};
export function isOpenFilmSource(source: SourceConfig): boolean {
  return process.env.ENABLE_OPEN_FILMS === 'true' &&
    source.key === OPEN_FILM_SOURCE.key && source.url === OPEN_FILM_SOURCE.url;
}
export function searchOpenFilms(query: string): SearchResultItem[] {
  const name = '大雄兔 Big Buck Bunny';
  if (!name.toLowerCase().includes(query.toLowerCase().trim())) return [];
  return [{
    sourceKey: OPEN_FILM_SOURCE.key, sourceName: OPEN_FILM_SOURCE.name,
    sourceUrl: OPEN_FILM_SOURCE.url, vodId: 'big-buck-bunny', name,
    year: '2008', typeName: '开放授权动画短片', area: '荷兰', remarks: 'CC BY 3.0 · 播放验收',
  }];
}
export function openFilmDetail(id: string): VideoDetail | null {
  if (id !== 'big-buck-bunny') return null;
  return {
    episodes: ['https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'],
    videoInfo: {
      title: '大雄兔 Big Buck Bunny', sourceKey: OPEN_FILM_SOURCE.key,
      sourceName: OPEN_FILM_SOURCE.name, sourceUrl: OPEN_FILM_SOURCE.url,
      year: '2008', typeName: '开放授权动画短片',
      desc: '© 2008 Blender Foundation / www.bigbuckbunny.org。CC BY 3.0 开放授权，保留完整片尾署名。授权说明：https://peach.blender.org/about/ 。流媒体由 Mux / hls.js 公开测试站提供，仅用于验收，服务可用性不作长期保证。本片无对白，不提供虚构的中文字幕。热门美剧需要另行获得授权的内容源。',
    },
  };
}
