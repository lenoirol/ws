import { describe, expect, it } from 'vitest';
import { fromSaved, toSaved } from '../../src/account/projectState.ts';
import { initialState } from '../../src/ui/state.ts';

describe('project state', () => {
  it('keeps worksheet settings and leaves out viewer preferences', () => {
    const saved = toSaved({ ...initialState(), text: 'cat\ndog', title: 'Animals', theme: 'dark', glassStyle: 'clear', zoom: 150 });
    expect(saved.text).toBe('cat\ndog');
    expect(saved.title).toBe('Animals');
    expect(saved).not.toHaveProperty('theme');
    expect(saved).not.toHaveProperty('glassStyle');
    expect(saved).not.toHaveProperty('zoom');
  });

  it('round-trips through JSON', () => {
    const original = { ...initialState(), text: 'a\nb', tab: 'scramble' as const, copies: 7, dirs: ['E' as const, 'S' as const] };
    const restored = fromSaved(JSON.parse(JSON.stringify(toSaved(original))), initialState());
    expect(restored.text).toBe('a\nb');
    expect(restored.tab).toBe('scramble');
    expect(restored.copies).toBe(7);
    expect(restored.dirs).toEqual(['E', 'S']);
    expect(restored.paper).toEqual(original.paper);
  });

  it('does not overwrite the viewer\'s appearance when opening a project', () => {
    const base = { ...initialState(), theme: 'dark' as const, zoom: 80 };
    const restored = fromSaved({ text: 'x', theme: 'light', zoom: 10 }, base);
    expect(restored.text).toBe('x');
    expect(restored.theme).toBe('dark');
    expect(restored.zoom).toBe(80);
  });

  it('ignores values of the wrong type and unknown keys', () => {
    const base = initialState();
    const restored = fromSaved({ text: 42, rows: 'many', dirs: 'E', paper: null, nonsense: true }, base);
    expect(restored.text).toBe(base.text);
    expect(restored.rows).toBe(base.rows);
    expect(restored.dirs).toEqual(base.dirs);
    expect(restored.paper).toEqual(base.paper);
    expect(restored).not.toHaveProperty('nonsense');
  });

  it('returns the base for non-object input', () => {
    const base = initialState();
    for (const bad of [null, undefined, 'x', 3, ['a']]) expect(fromSaved(bad, base)).toBe(base);
  });

  it('keeps chosen fonts and replaces unknown ones', () => {
    const base = initialState();
    const saved = JSON.parse(JSON.stringify(toSaved({ ...base, fonts: { ...base.fonts, title: 'Nunito', puzzle: 'JetBrains Mono' } })));
    expect(fromSaved(saved, base).fonts).toMatchObject({ title: 'Nunito', puzzle: 'JetBrains Mono', name: 'Helvetica' });
    const odd = fromSaved({ fonts: { title: 'Comic Sans', name: 7, list: 'Lexend' } }, base);
    expect(odd.fonts).toMatchObject({ title: 'Helvetica', name: 'Helvetica', list: 'Lexend' });
  });
});
