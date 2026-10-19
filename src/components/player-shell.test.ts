import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Artplayer from 'artplayer';

// Exercise the locked dependency's actual Control and video click handlers without
// claiming DOM layout, touch synthesis, media playback, or iOS fullscreen coverage.
const require = createRequire(import.meta.url);
const upstream = readFileSync(require.resolve('artplayer').replace(/artplayer\.js$/, 'artplayer.mjs'), 'utf8');
const shell = readFileSync(new URL('./player-shell.tsx', import.meta.url), 'utf8');
function declaration(source: string, name: string) {
  const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = ast.statements.find((statement) =>
    (ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement)) && statement.name?.text === name);
  if (!node) throw new Error(`Missing ${name}; review the dependency integration`);
  return node.getText(ast);
}
const mobileClass = ts.transpile(declaration(shell, 'MobileArtplayer'), { target: ts.ScriptTarget.ES2022 });
const MobileArtplayer = new Function('Artplayer', `${mobileClass}; return MobileArtplayer`)(Artplayer);
class Component {
  art: Fixture;
  private visible = true;
  constructor(art: Fixture) { this.art = art; }
  get show() { return this.visible; }
  set show(value: boolean) { this.visible = value; this.art.emit('control', value); }
  toggle() { this.show = !this.show; }
}
class Fixture extends EventEmitter {
  setting = { show: false };
  isInput = false;
  isLock = false;
  playing = true;
  template = { $video: new EventTarget(), $player: {}, $bottom: {} };
  controls!: Component;
  toggle = vi.fn();
  fullscreen = false;
}
function setup(mobile = true) {
  const art = new Fixture();
  Object.defineProperty(art, 'constructor', { value: mobile ? MobileArtplayer : Artplayer });
  const noop = () => {};
  const Control = new Function('Component', 'isMobile', 'includeFromEvent', 'removeClass', 'addClass',
    `${declaration(upstream, 'Control')}; return Control`)(Component, mobile, () => false, noop, noop);
  // Skip DOM construction only; keep upstream event registration and state logic.
  Control.prototype.init = noop;
  art.controls = new Control(art);
  const listeners: (() => void)[] = [];
  const events = { proxy(target: EventTarget, name: string, listener: EventListener) {
    target.addEventListener(name, listener);
    listeners.push(() => target.removeEventListener(name, listener));
  } };
  new Function('isMobile', 'includeFromEvent', `${declaration(upstream, 'clickInit')}; return clickInit`)
    (mobile, () => false)(art, events);
  return { art, tap: () => art.template.$video.dispatchEvent(new Event('click')),
    destroy: () => { listeners.forEach((remove) => remove()); art.removeAllListeners(); } };
}
afterEach(() => vi.useRealTimers());
describe('player-shell control policy against locked ArtPlayer', () => {
  it('keeps mobile controls visible beyond three seconds and still toggles on video taps', () => {
    vi.useFakeTimers();
    const { art, tap, destroy } = setup();
    vi.advanceTimersByTime(10_000);
    art.emit('video:timeupdate');
    expect(art.controls.show).toBe(true);
    tap();
    expect(art.controls.show).toBe(false);
    vi.advanceTimersByTime(1000);
    art.emit('video:timeupdate');
    expect(art.controls.show).toBe(false);
    tap();
    expect(art.controls.show).toBe(true);
    expect(art.toggle).not.toHaveBeenCalled();
    destroy();
  });
  it('preserves desktop timeout while mobile and desktop instances coexist', () => {
    vi.useFakeTimers();
    const mobile = setup();
    const desktop = setup(false);
    vi.advanceTimersByTime(4000);
    mobile.art.emit('video:timeupdate');
    desktop.art.emit('video:timeupdate');
    expect(mobile.art.controls.show).toBe(true);
    expect(desktop.art.controls.show).toBe(false);
    expect(Artplayer.CONTROL_HIDE_TIME).toBe(3000);
    mobile.destroy(); desktop.destroy();
  });
  it('keeps controls available during and after a settings interaction', () => {
    vi.useFakeTimers();
    const { art, destroy } = setup();
    art.setting.show = true;
    vi.advanceTimersByTime(4000);
    art.emit('video:timeupdate');
    art.setting.show = false;
    vi.advanceTimersByTime(4000);
    art.emit('video:timeupdate');
    expect(art.controls.show).toBe(true);
    destroy();
  });
  it('does not change shared configuration across repeated construction and teardown', () => {
    for (let i = 0; i < 3; i++) {
      const { art, tap, destroy } = setup();
      destroy();
      tap();
      expect(art.listenerCount('video:timeupdate')).toBe(0);
      expect(art.controls.show).toBe(true);
      expect(Artplayer.CONTROL_HIDE_TIME).toBe(3000);
    }
  });
});

function touchHandlers() {
  const start = shell.indexOf('    let longPressTimer:');
  const end = shell.indexOf('    // ArtPlayer 的 contextmenu', start);
  const source = ts.transpile(shell.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  const art = { video: { paused: false, playbackRate: 1.5 } };
  const showHint = vi.fn();
  const cleanup = shell.match(/^\s*if \(longPressTimer\) clearTimeout\(longPressTimer\);/m)?.[0];
  if (!cleanup) throw new Error('Missing unmount timer cleanup');
  const handlers = new Function('art', 'showHint', 'containerRef',
    `${source}; return { onTouchStart, onTouchEnd, onTouchMove, dispose: () => { ${cleanup} } }`)
    (art, showHint, { current: null });
  const touch = (ancestor = '') => ({ target: { closest: (selectors: string) =>
    selectors.split(',').some((selector) => selector.trim() === ancestor) ? {} : null } });
  return { art, showHint, handlers, touch };
}
describe('existing long press interaction', () => {
  it.each(['.art-bottom', '.art-settings'])('does not arm 3x on %s (including progress descendants)', (ancestor) => {
    vi.useFakeTimers();
    const { art, handlers, touch } = touchHandlers();
    handlers.onTouchStart(touch(ancestor));
    vi.advanceTimersByTime(1000);
    expect(art.video.playbackRate).toBe(1.5);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains 3x hold, restores the prior rate on end/cancel, and ignores a second finger', () => {
    vi.useFakeTimers();
    const { art, handlers, touch } = touchHandlers();
    handlers.onTouchStart(touch());
    vi.advanceTimersByTime(500);
    expect(art.video.playbackRate).toBe(3);
    handlers.onTouchStart(touch());
    const preventDefault = vi.fn();
    handlers.onTouchMove({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    handlers.onTouchEnd();
    expect(art.video.playbackRate).toBe(1.5);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the pending hold on unmount before it can change rate or update hint state', () => {
    vi.useFakeTimers();
    const { art, showHint, handlers, touch } = touchHandlers();
    handlers.onTouchStart(touch());
    handlers.dispose();
    vi.advanceTimersByTime(1000);
    expect(art.video.playbackRate).toBe(1.5);
    expect(showHint).not.toHaveBeenCalled();
  });
});
