import { MAX_COPIES, MAX_GRID, MIN_GRID } from '../../core/constants.ts';
import { ALL_DIRS, DIR_PRESETS, type Dir } from '../../core/wordsearch/types.ts';
import { t } from '../i18n.ts';
import { KIDS_PRESET, type AppState, type ComboId } from '../state.ts';
import { Disclosure, Group, Row, Segmented, Slider, SwitchRow } from './Fields.tsx';

type Props = { s: AppState; set: (patch: Partial<AppState>) => void };

const ARROWS: Record<Dir, string> = { E: '→', W: '←', S: '↓', N: '↑', SE: '↘', NW: '↖', NE: '↗', SW: '↙' };
const DIR_GRID: (Dir | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
const REVERSE: Dir[] = ['W', 'N', 'NW', 'SW'];
const DIAGONAL: Dir[] = ['SE', 'NW', 'NE', 'SW'];
const SIZE_PRESETS = [10, 15, 20, 32, 48, 64];

const sameDirs = (a: readonly Dir[], b: readonly Dir[]) => a.length === b.length && b.every((d) => a.includes(d));
const clampSize = (n: number) => Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(n) || MIN_GRID));

function Select({ value, onChange, options }: { value: string | number; onChange: (v: string) => void; options: { value: string | number; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function GridSize({ s, set }: Props) {
  const setRows = (v: number) => set(s.square ? { rows: clampSize(v), cols: clampSize(v) } : { rows: clampSize(v) });
  const setCols = (v: number) => set(s.square ? { rows: clampSize(v), cols: clampSize(v) } : { cols: clampSize(v) });
  return (
    <Group title={t('size')}>
      <div className="row row-wide">
        <Segmented
          label={t('size')}
          value={s.sizeMode}
          onChange={(v) => set({ sizeMode: v })}
          options={[{ value: 'auto', label: t('sizeAuto') }, { value: 'manual', label: t('sizeManual') }]}
        />
      </div>
      {s.sizeMode === 'manual' && (
        <>
          <div className="row row-wide chips">
            {SIZE_PRESETS.map((n) => (
              <button key={n} type="button" className={`chip ${s.rows === n && s.cols === n ? 'on' : ''}`} onClick={() => set({ rows: n, cols: n })}>{n}</button>
            ))}
          </div>
          <Row label={t('rows')}>
            <input type="number" min={MIN_GRID} max={MAX_GRID} value={s.rows} onChange={(e) => setRows(Number(e.target.value))} />
          </Row>
          <Row label={t('cols')}>
            <input type="number" min={MIN_GRID} max={MAX_GRID} value={s.cols} onChange={(e) => setCols(Number(e.target.value))} />
          </Row>
          <div className="row row-wide">
            <Slider label={t('rows')} min={MIN_GRID} max={MAX_GRID} value={s.rows} onChange={setRows} />
          </div>
          {!s.square && (
            <div className="row row-wide">
              <Slider label={t('cols')} min={MIN_GRID} max={MAX_GRID} value={s.cols} onChange={setCols} />
            </div>
          )}
          <SwitchRow label={t('square')} checked={s.square} onChange={(v) => set(v ? { square: true, cols: s.rows } : { square: false })} />
        </>
      )}
    </Group>
  );
}

export function WordSearchOptions({ s, set }: Props) {
  const toggleDir = (d: Dir) => set({ dirs: s.dirs.includes(d) ? s.dirs.filter((x) => x !== d) : ALL_DIRS.filter((x) => s.dirs.includes(x) || x === d) });
  const toggleGroup = (group: Dir[], on: boolean) => set({ dirs: ALL_DIRS.filter((d) => (group.includes(d) ? on : s.dirs.includes(d))) });
  const has = (group: Dir[]) => group.every((d) => s.dirs.includes(d));
  return (
    <>
      <GridSize s={s} set={set} />
      <Group title={t('directions')}>
        <div className="row row-wide chips">
          <button type="button" className={`chip ${sameDirs(s.dirs, DIR_PRESETS.easy) ? 'on' : ''}`} onClick={() => set({ dirs: [...DIR_PRESETS.easy] })}>{t('presetEasy')}</button>
          <button type="button" className={`chip ${sameDirs(s.dirs, DIR_PRESETS.medium) ? 'on' : ''}`} onClick={() => set({ dirs: [...DIR_PRESETS.medium] })}>{t('presetMedium')}</button>
          <button type="button" className={`chip ${sameDirs(s.dirs, DIR_PRESETS.hard) ? 'on' : ''}`} onClick={() => set({ dirs: [...DIR_PRESETS.hard] })}>{t('presetHard')}</button>
          <button type="button" className="chip" onClick={() => set(KIDS_PRESET)}>{t('presetKids')}</button>
        </div>
        <div className="row row-wide">
          <div className="dirpad" role="group" aria-label={t('directions')}>
            {DIR_GRID.map((d, i) =>
              d ? (
                <button key={d} type="button" aria-pressed={s.dirs.includes(d)} aria-label={d} className={`dir ${s.dirs.includes(d) ? 'on' : ''}`} onClick={() => toggleDir(d)}>
                  {ARROWS[d]}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>
        <SwitchRow label={t('allowReverse')} checked={has(REVERSE)} onChange={(v) => toggleGroup(REVERSE, v)} />
        <SwitchRow label={t('allowDiagonal')} checked={has(DIAGONAL)} onChange={(v) => toggleGroup(DIAGONAL, v)} />
        <SwitchRow label={t('allowOverlap')} checked={s.allowOverlap} onChange={(v) => set({ allowOverlap: v })} />
      </Group>
      <Disclosure title={t('advanced')}>
        <Row label={t('fill')}>
          <Select value={s.fillMode} onChange={(v) => set({ fillMode: v as AppState['fillMode'] })} options={[{ value: 'uniform', label: t('fillUniform') }, { value: 'fromWords', label: t('fillFromWords') }]} />
        </Row>
        <Row label={t('listMode')}>
          <Select value={s.listMode} onChange={(v) => set({ listMode: v as AppState['listMode'] })} options={[{ value: 'words', label: t('listWords') }, { value: 'clues', label: t('listClues') }, { value: 'both', label: t('listBoth') }, { value: 'none', label: t('listNone') }]} />
        </Row>
        <Row label={t('listColumns')}>
          <Select
            value={s.listColumns}
            onChange={(v) => set({ listColumns: (v === 'auto' ? 'auto' : Number(v)) as AppState['listColumns'] })}
            options={[{ value: 'auto', label: t('auto') }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))]}
          />
        </Row>
        <SwitchRow label={t('frame')} checked={s.frame} onChange={(v) => set({ frame: v })} />
        <SwitchRow label={t('cellLines')} checked={s.cellLines} onChange={(v) => set({ cellLines: v })} />
        <SwitchRow label={t('boldLetters')} checked={s.boldLetters} onChange={(v) => set({ boldLetters: v })} />
      </Disclosure>
    </>
  );
}

export function ScrambleOptions({ s, set }: Props) {
  return (
    <Group title={t('scrambleGroup')}>
      <Row label={t('firstLetter')}>
        <Select value={s.firstLetter} onChange={(v) => set({ firstLetter: v as AppState['firstLetter'] })} options={[{ value: 'free', label: t('firstFree') }, { value: 'keep', label: t('firstKeep') }, { value: 'change', label: t('firstChange') }]} />
      </Row>
      <Row label={t('hints')}>
        <Select value={s.hintKind} onChange={(v) => set({ hintKind: v as AppState['hintKind'] })} options={[{ value: 'none', label: t('hintNone') }, { value: 'first', label: t('hintFirst') }, { value: 'firstLast', label: t('hintFirstLast') }, { value: 'random', label: t('hintRandom') }]} />
      </Row>
      {s.hintKind === 'random' && (
        <Row label={t('hintCount')}>
          <input type="number" min={1} max={10} value={s.hintCount} onChange={(e) => set({ hintCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
        </Row>
      )}
      <SwitchRow label={t('showClues')} checked={s.scrambleClues} onChange={(v) => set({ scrambleClues: v })} />
    </Group>
  );
}

export function CrosswordOptions({ s, set }: Props) {
  return (
    <Group title={t('cwGroup')}>
      <SwitchRow label={t('cwShowLength')} checked={s.cwShowLength} onChange={(v) => set({ cwShowLength: v })} />
      <SwitchRow label={t('cwWordBank')} checked={s.cwWordBank} onChange={(v) => set({ cwWordBank: v })} />
      <p className="pp-hint">{t('cwHint')}</p>
    </Group>
  );
}

export function ComboOptions({ s, set }: Props) {
  return (
    <Group title={t('comboGroup')}>
      <Row label={t('comboPair')}>
        <Select
          value={s.combo}
          onChange={(v) => set({ combo: v as ComboId })}
          options={[{ value: 'ws+scramble', label: t('comboWsScr') }, { value: 'ws+crossword', label: t('comboWsCw') }, { value: 'crossword+scramble', label: t('comboCwScr') }]}
        />
      </Row>
      <p className="pp-hint">{t('comboHint')}</p>
    </Group>
  );
}

export function SharedOptions({ s, set }: Props) {
  return (
    <>
      <Group title={t('pageGroup')}>
        <Row label={t('titleLabel')}>
          <input type="text" value={s.title} placeholder="Optional" onChange={(e) => set({ title: e.target.value })} />
        </Row>
        <SwitchRow label={t('showName')} checked={s.showName} onChange={(v) => set({ showName: v })} />
        {s.showName && (
          <Row label={t('nameLabel')}>
            <input type="text" value={s.nameLabel} onChange={(e) => set({ nameLabel: e.target.value })} />
          </Row>
        )}
        <Row label={t('footer')}>
          <input type="text" value={s.footer} placeholder="Optional" onChange={(e) => set({ footer: e.target.value })} />
        </Row>
        <Row label={t('paper')}>
          <Select value={s.paper.id} onChange={(v) => set({ paper: { ...s.paper, id: v as AppState['paper']['id'] } })} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }, { value: 'A3', label: 'A3' }]} />
        </Row>
        <Row label={t('orientation')}>
          <Select value={s.paper.orientation} onChange={(v) => set({ paper: { ...s.paper, orientation: v as AppState['paper']['orientation'] } })} options={[{ value: 'portrait', label: t('portrait') }, { value: 'landscape', label: t('landscape') }]} />
        </Row>
      </Group>
      <Disclosure title={t('advanced')}>
        <Row label={t('copies')}>
          <input type="number" min={1} max={MAX_COPIES} value={s.copies} onChange={(e) => set({ copies: Math.max(1, Math.min(MAX_COPIES, Math.floor(Number(e.target.value)) || 1)) })} />
        </Row>
        <Row label={t('dpi')}>
          <Select value={s.dpi} onChange={(v) => set({ dpi: Number(v) as AppState['dpi'] })} options={[150, 300, 600].map((d) => ({ value: d, label: `${d} DPI` }))} />
        </Row>
        <Row label={t('seed')}>
          <input type="number" min={0} value={s.seed} onChange={(e) => set({ seed: Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
        </Row>
      </Disclosure>
    </>
  );
}
