// Своя ГИС — прогноз v2: время прибытия и запас, «самое позднее», итог цветом; выбор времени (Прибыть к / Выйти в / колесо).
// Общие помощники и иконки — как в плагине «Без машины».

const PAL = {
  bg: ['Карта/Фон', '#6C6CF0'], river: ['Карта/Река', '#8C8DF5'], glass: ['Карта/Плашка', '#8485F3'],
  lime: ['Трафик/Свободно', '#C8F06A'], orange: ['Трафик/Плотно', '#FFB27A'], pink: ['Трафик/Пробка', '#F7A8D8'],
  limeP: ['Акценты/Лайм', '#D4F27A'], limeT: ['Акценты/Лайм текст', '#27500A'],
  orangeT: ['Акценты/Оранжевый текст', '#4A1B0C'],
  pinkL: ['Акценты/Розовый', '#F4C0D1'], pinkT: ['Акценты/Розовый текст', '#72243E'],
  lav: ['Акценты/Лаванда', '#EEEDFE'], lavT: ['Акценты/Лаванда текст', '#3C3489'],
  accent: ['Текст/Акцент', '#534AB7'], ink: ['Текст/Основной', '#26215C'], mute: ['Текст/Приглушённый', '#888780'],
  white: ['Поверхности/Белый', '#FFFFFF'], soft: ['Поверхности/Подложка', '#F4F3EE'],
  line: ['Линии/Обводка', '#E2E0D8'], dash: ['Линии/Пунктир', '#B4B2A9'],
  dark: ['Светофор/Корпус', '#1D1B40'], off: ['Светофор/Выключен', '#3A3A6A']
};
const TS = {
  title: ['ГИС/Заголовок', 20, 'Medium'], big: ['ГИС/Крупный', 18, 'Medium'],
  body: ['ГИС/Текст', 14, 'Regular'], bodyM: ['ГИС/Текст акцент', 14, 'Medium'],
  cap: ['ГИС/Подпись', 13, 'Regular'], small: ['ГИС/Мелкий', 12, 'Regular'], tiny: ['ГИС/Метка', 11, 'Regular']
};
const V = {}, S = {};

function rgb(h) {
  return { r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 };
}
function pv(key) {
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: rgb(PAL[key][1]) }, 'color', V[key]);
}
async function setupVariables() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find(c => c.name === 'ГИС · Цвета');
  if (!col) col = figma.variables.createVariableCollection('ГИС · Цвета');
  const mode = col.modes[0].modeId;
  const existing = (await figma.variables.getLocalVariablesAsync('COLOR')).filter(v => v.variableCollectionId === col.id);
  for (const key of Object.keys(PAL)) {
    const [name, hex] = PAL[key];
    let v = existing.find(x => x.name === name);
    if (!v) { v = figma.variables.createVariable(name, col, 'COLOR'); const c = rgb(hex); v.setValueForMode(mode, { r: c.r, g: c.g, b: c.b, a: 1 }); }
    V[key] = v;
  }
}
async function setupTextStyles() {
  const styles = await figma.getLocalTextStylesAsync();
  for (const key of Object.keys(TS)) {
    const [name, size, weight] = TS[key];
    let s = styles.find(x => x.name === name);
    if (!s) { s = figma.createTextStyle(); s.name = name; s.fontName = { family: 'Inter', style: weight }; s.fontSize = size; }
    S[key] = s;
  }
}

// ---------- Помощники ----------
async function TX(parent, str, style, color, o) {
  o = o || {};
  const t = figma.createText();
  await t.setTextStyleIdAsync(S[style].id);
  t.characters = str;
  t.fills = [pv(color || 'ink')];
  t.name = o.name || str;
  parent.appendChild(t);
  if (o.fill) { t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; }
  if (o.x != null) { t.x = o.x; t.y = o.y; }
  return t;
}
function AL(parent, dir, o) {
  o = o || {};
  const f = figma.createFrame();
  f.name = o.name || 'Группа';
  if (o.w) f.resize(o.w, 10);
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = o.w ? 'FIXED' : 'AUTO';
  f.itemSpacing = o.gap || 0;
  const p = o.pad == null ? 0 : o.pad;
  f.paddingLeft = f.paddingRight = o.px != null ? o.px : p;
  f.paddingTop = f.paddingBottom = o.py != null ? o.py : p;
  f.cornerRadius = o.r || 0;
  f.fills = o.bg ? [pv(o.bg)] : [];
  if (o.stroke) { f.strokes = [pv(o.stroke)]; f.strokeWeight = 1; f.strokesIncludedInLayout = false; }
  f.counterAxisAlignItems = o.align || 'MIN';
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.gap || 0; }
  if (parent) parent.appendChild(f);
  if (o.fill) f.layoutSizingHorizontal = 'FILL';
  if (o.x != null) { f.x = o.x; f.y = o.y; }
  return f;
}
function SPACER(parent, h) {
  const s = figma.createFrame();
  s.name = h ? 'Отступ' : 'Растяжка';
  s.resize(10, h || 1); s.fills = [];
  parent.appendChild(s);
  s.layoutSizingHorizontal = 'FILL';
  if (!h) s.layoutGrow = 1;
  return s;
}
function L(parent, pts, color, sw, o) {
  o = o || {};
  const xs = pts.map(a => a[0]), ys = pts.map(a => a[1]);
  const mx = Math.min(...xs), my = Math.min(...ys);
  const v = figma.createVector();
  v.vectorPaths = [{ windingRule: 'NONE', data: pts.map((a, i) => (i ? 'L ' : 'M ') + (a[0] - mx).toFixed(1) + ' ' + (a[1] - my).toFixed(1)).join(' ') }];
  v.strokes = [pv(color)];
  if (o.op != null && o.op < 1) v.opacity = o.op;
  if (o.dash) v.dashPattern = o.dash;
  v.strokeWeight = sw; v.strokeCap = 'ROUND'; v.strokeJoin = 'ROUND';
  parent.appendChild(v); v.x = mx; v.y = my;
  v.name = o.name || 'Линия';
  return v;
}
function EL(parent, cx, cy, rx, ry, o) {
  const e = figma.createEllipse();
  e.resize(rx * 2, ry * 2);
  e.fills = o.fill ? [pv(o.fill)] : [];
  if (o.stroke) { e.strokes = [pv(o.stroke)]; e.strokeWeight = o.sw || 1; if (o.dash) e.dashPattern = o.dash; }
  if (o.op != null && o.op < 1) e.opacity = o.op;
  e.name = o.name || 'Эллипс';
  parent.appendChild(e); e.x = cx - rx; e.y = cy - ry;
  return e;
}
function put(parent, node, o) {
  o = o || {};
  parent.appendChild(node);
  if (o.fill) node.layoutSizingHorizontal = 'FILL';
  if (o.cx != null) { node.x = o.cx - node.width / 2; node.y = o.cy - node.height / 2; }
  else if (o.x != null) { node.x = o.x; node.y = o.y; }
  return node;
}
function pkey(node, name) {
  let d = {}; try { d = node.componentPropertyDefinitions; } catch (e) { return null; }
  return Object.keys(d).find(k => k.split('#')[0] === name && d[k].type !== 'VARIANT');
}
// Экземпляр: sel — варианты, texts — {ИмяСвойства: значение}, bools — {ИмяСвойства: true/false}
// Свойства варианта читаем из имени («Тип=Активная, Нажатие=Нет»): так работает, даже если в наборе есть ошибки
function vprops(ch) { const o = {}; String(ch.name).split(',').forEach(p => { const [k, v] = p.split('='); if (v != null) o[k.trim()] = v.trim(); }); return o; }
const SET_ISSUES = new Set();
function inst(K, sel, texts, bools) {
  let comp = K;
  if (K.type === 'COMPONENT_SET') {
    const want = Object.assign({ 'Нажатие': 'Нет' }, sel || {});
    const kids = K.children.filter(c => c.type === 'COMPONENT');
    const seen = {}; kids.forEach(c => { if (seen[c.name]) SET_ISSUES.add('«' + K.name + '»: два варианта «' + c.name + '»'); seen[c.name] = 1; });
    comp = kids.find(ch => { const vp = vprops(ch); return Object.entries(want).every(([k, v]) => vp[k] === undefined || vp[k] === v); })
      || kids.find(ch => { const vp = vprops(ch); return Object.entries(sel || {}).every(([k, v]) => vp[k] === v); })
      || kids[0];
  }
  const i = comp.createInstance();
  const p = {};
  let defs = {};
  try { defs = K.componentPropertyDefinitions; } catch (e) { SET_ISSUES.add('«' + K.name + '»: Figma сообщает об ошибке в наборе'); }
  const key = n => Object.keys(defs).find(k => k.split('#')[0] === n && defs[k].type !== 'VARIANT');
  Object.entries(texts || {}).forEach(([n, v]) => { const k = key(n); if (k) p[k] = v; });
  Object.entries(bools || {}).forEach(([n, v]) => { const k = key(n); if (k) p[k] = v; });
  if (Object.keys(p).length) { try { i.setProperties(p); } catch (e) { SET_ISSUES.add('«' + K.name + '»: не удалось задать свойства (' + e.message + ')'); } }
  return i;
}

// ---------- Библиотека v2 ----------
let CP, LIB = {};
async function loadLibrary() {
  CP = figma.root.children.find(p => p.name === 'ГИС · Компоненты');
  if (!CP) throw new Error('Не найдена страница «ГИС · Компоненты». Сначала запусти плагин v2.');
  await CP.loadAsync();
  const find = n => CP.findOne(x => (x.type === 'COMPONENT_SET' || x.type === 'COMPONENT') && x.name === n);
  const need = ['Пилюля', 'Сегмент', 'Шаг пути', 'Маркер / Старт', 'Маркер / Финиш', 'Маркер / Остановка'];
  for (const n of need) { LIB[n] = find(n); if (!LIB[n]) throw new Error('Не найден компонент «' + n + '» на странице компонентов.'); }
  LIB.find = find;
}

// ---------- Новые компоненты ----------
function bindTexts(owner, names) {
  const nodes = owner.type === 'COMPONENT_SET' ? owner.children : [owner];
  names.forEach(([name, def]) => {
    const key = owner.addComponentProperty(name, 'TEXT', def);
    nodes.forEach(c => { const t = c.findOne(n => n.name === name); if (t) t.componentPropertyReferences = { characters: key }; });
  });
}
function tidySet(set, name, dir) {
  set.name = name;
  set.layoutMode = dir || 'HORIZONTAL';
  set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 16;
  set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 20;
  set.counterAxisAlignItems = 'CENTER';
}
function compAL(name, dir, o) {
  const c = figma.createComponent();
  c.name = name;
  if (o.w) c.resize(o.w, o.h || 40);
  c.layoutMode = dir;
  c.primaryAxisSizingMode = o.w && dir === 'HORIZONTAL' ? 'FIXED' : 'AUTO';
  c.counterAxisSizingMode = o.fixedH ? 'FIXED' : 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  if (o.center) c.primaryAxisAlignItems = 'CENTER';
  c.paddingLeft = c.paddingRight = o.px || 0;
  c.paddingTop = c.paddingBottom = o.py || 0;
  c.itemSpacing = o.gap || 0;
  c.cornerRadius = o.r || 0;
  c.fills = o.bg ? [pv(o.bg)] : [];
  if (o.stroke) { c.strokes = [pv(o.stroke)]; c.strokeWeight = o.sw || 1; c.strokesIncludedInLayout = false; }
  return c;
}
async function getOrBuild(name, build) {
  const ex = LIB.find(name);
  if (ex) return ex;
  const n = await build();
  return n;
}
async function buildResult() {
  const comps = [];
  for (const sel of [false, true]) {
    const c = compAL('Состояние=' + (sel ? 'Выбран' : 'Обычный'), 'HORIZONTAL', { w: 272, h: 60, px: 10, py: 10, gap: 10, r: 14, bg: sel ? 'lav' : null, stroke: sel ? 'accent' : null });
    const num = figma.createFrame();
    num.name = 'Кружок'; num.resize(24, 24);
    num.layoutMode = 'HORIZONTAL'; num.primaryAxisSizingMode = 'FIXED'; num.counterAxisSizingMode = 'FIXED';
    num.primaryAxisAlignItems = 'CENTER'; num.counterAxisAlignItems = 'CENTER';
    num.cornerRadius = 12; num.fills = [pv(sel ? 'orange' : 'ink')];
    c.appendChild(num);
    await TX(num, '1', 'small', sel ? 'orangeT' : 'white', { name: 'Номер' });
    const info = AL(c, 'VERTICAL', { name: 'Инфо', gap: 2 });
    info.layoutGrow = 1;
    await TX(info, 'Зерно', 'body', 'ink', { name: 'Название', fill: true });
    await TX(info, '+2 мин к пути · оценка 4,8', 'small', sel ? 'lavT' : 'mute', { name: 'Детали', fill: true });
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Результат поиска', 'VERTICAL');
  bindTexts(set, [['Номер', '1'], ['Название', 'Зерно'], ['Детали', '+2 мин к пути · оценка 4,8']]);
  return set;
}
async function buildPin() {
  const comps = [];
  for (const sel of [false, true]) {
    const d = sel ? 30 : 24;
    const c = compAL('Состояние=' + (sel ? 'Выбран' : 'Обычный'), 'HORIZONTAL', { w: d, h: d, fixedH: true, center: true, r: d / 2, bg: sel ? 'orange' : 'ink', stroke: 'white', sw: 2.5 });
    await TX(c, '1', sel ? 'small' : 'tiny', sel ? 'orangeT' : 'white', { name: 'Номер' });
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Пин места');
  set.fills = [pv('bg')];
  bindTexts(set, [['Номер', '1']]);
  return set;
}
async function buildCategory() {
  const comps = [];
  for (const on of [true, false]) {
    const c = compAL('Состояние=' + (on ? 'Вкл' : 'Выкл'), 'HORIZONTAL', { w: 60, h: 28, fixedH: true, px: 12, r: 14, bg: on ? 'limeP' : 'soft' });
    c.primaryAxisSizingMode = 'AUTO';
    await TX(c, 'Кофе', 'small', on ? 'limeT' : 'mute', { name: 'Текст' });
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Категория');
  bindTexts(set, [['Текст', 'Кофе']]);
  return set;
}
async function buildBadge() {
  const comps = [];
  for (const [t, bg, fg] of [['Успеешь', 'limeP', 'limeT'], ['Впритык', 'orange', 'orangeT']]) {
    const c = compAL('Тон=' + t, 'HORIZONTAL', { px: 8, py: 3, r: 10, bg });
    await TX(c, 'успеешь', 'tiny', fg, { name: 'Текст' });
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Бейдж');
  bindTexts(set, [['Текст', 'успеешь']]);
  return set;
}
async function buildTemplateChip() {
  const c = compAL('Чип шаблона', 'HORIZONTAL', { px: 12, py: 6, gap: 6, r: 14, bg: 'lav' });
  await TX(c, 'По пути на работу', 'cap', 'lavT', { name: 'Текст' });
  const v = figma.createVector();
  v.name = 'Шеврон';
  v.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L 4 4 L 8 0' }];
  v.strokes = [pv('lavT')]; v.strokeWeight = 1.5; v.strokeCap = 'ROUND'; v.strokeJoin = 'ROUND';
  c.appendChild(v);
  CP.appendChild(c);
  bindTexts(c, [['Текст', 'По пути на работу']]);
  return c;
}

// ---------- Карта ----------
const CX = 480, CY = 400;
const RINGS = [[150, 120], [290, 230], [440, 360]];
const RADIALS = [[480, -20], [980, 250], [980, 570], [520, 820], [-20, 660], [-20, 220]];
const R2 = RINGS[1], IN = RADIALS[4], OUT = RADIALS[1], A0 = 146.8, A1 = -20.7;
function rad(end, t) { return [CX + (end[0] - CX) * t, CY + (end[1] - CY) * t]; }
function ell(r, deg) { const a = deg * Math.PI / 180; return [CX + r[0] * Math.cos(a), CY + r[1] * Math.sin(a)]; }
function arc(r, d0, d1) {
  const pts = [], n = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 6));
  for (let i = 0; i <= n; i++) pts.push(ell(r, d0 + (d1 - d0) * i / n));
  return pts;
}
const START = rad(IN, 0.75), FINISH = rad(OUT, 0.85);
function mapFrame(screen) {
  const m = figma.createFrame();
  m.name = 'Карта'; m.resize(960, 800); m.fills = [pv('bg')]; m.clipsContent = true;
  screen.appendChild(m); m.x = 320; m.y = 0;
  const roads = figma.createFrame();
  roads.name = 'Дороги'; roads.resize(960, 800); roads.fills = []; m.appendChild(roads);
  RINGS.forEach(r => EL(roads, CX, CY, r[0], r[1], { stroke: 'lime', op: 0.3, sw: 3, name: 'Кольцевая' }));
  RADIALS.forEach(e => L(roads, [[CX, CY], e], 'lime', 3, { op: 0.3, name: 'Радиальная' }));
  L(roads, [[0, 480], [290, 440], [670, 464], [960, 376]], 'river', 22, { op: 0.45, name: 'Река' });
  return m;
}
function screen(page, name, x) {
  const s = figma.createFrame();
  s.name = name; s.resize(1280, 800); s.cornerRadius = 24; s.clipsContent = true; s.fills = [pv('white')];
  page.appendChild(s); s.x = x; s.y = 0;
  const sb = figma.createFrame();
  sb.name = 'Сайдбар'; sb.resize(320, 800);
  sb.layoutMode = 'VERTICAL'; sb.primaryAxisSizingMode = 'FIXED'; sb.counterAxisSizingMode = 'FIXED';
  sb.paddingLeft = sb.paddingRight = 24; sb.paddingTop = 28; sb.paddingBottom = 28; sb.itemSpacing = 10;
  sb.fills = [pv('white')];
  s.appendChild(sb); sb.x = 0; sb.y = 0;
  return { s, sb };
}
let RES, PIN, CAT, BADGE, TCHIP;
async function searchHeader(sb, query) {
  const f = AL(sb, 'HORIZONTAL', { name: 'Поиск', gap: 8, px: 16, py: 10, r: 20, stroke: 'line', align: 'CENTER', fill: true });
  const i = figma.createEllipse(); i.name = 'Иконка'; i.resize(16, 16); i.fills = [pv('mute')]; i.opacity = 0.3; f.appendChild(i);
  await TX(f, query, 'body', 'ink', { name: 'Запрос' });
  const cats = AL(sb, 'HORIZONTAL', { name: 'Категории', gap: 6, wrap: true, fill: true });
  ['Кофе', 'Поесть', 'Аптека', 'Продукты', 'АЗС'].forEach((c, k) => put(cats, inst(CAT, { 'Состояние': k === 0 ? 'Вкл' : 'Выкл' }, { 'Текст': c })));
}
function segment(parent, labels, act) {
  const f = AL(parent, 'HORIZONTAL', { name: 'Переключатель', pad: 3, r: 20, bg: 'soft', fill: true });
  labels.forEach((l, i) => put(f, inst(LIB['Сегмент'], { 'Состояние': i === act ? 'Вкл' : 'Выкл' }, { 'Текст': l }), { fill: true }));
  return f;
}
function result(parent, n, title, details, selected) {
  return put(parent, inst(RES, { 'Состояние': selected ? 'Выбран' : 'Обычный' }, { 'Номер': String(n), 'Название': title, 'Детали': details }), { fill: true });
}
function pin(map, n, x, y, selected) {
  return put(map, inst(PIN, { 'Состояние': selected ? 'Выбран' : 'Обычный' }, { 'Номер': String(n) }), { cx: x, cy: y });
}
function marker(map, name, x, y) { return put(map, LIB[name].createInstance(), { cx: x, cy: y }); }
async function placeCard(map, title, details, actionText, badge) {
  const card = AL(map, 'HORIZONTAL', { name: 'Карточка места', gap: 12, px: 18, py: 14, r: 22, bg: 'white', align: 'CENTER', x: 24, y: 700 });
  const info = AL(card, 'VERTICAL', { name: 'Инфо', gap: 4 });
  await TX(info, title, 'big', 'ink');
  await TX(info, details, 'cap', 'accent');
  if (badge) put(info, inst(BADGE, { 'Тон': badge[0] }, { 'Текст': badge[1] }));
  put(card, inst(LIB['Пилюля'], { 'Тип': 'Кнопка' }, { 'Текст': 'В шаблоны' }, { 'Иконка': true }));
  put(card, inst(LIB['Пилюля'], { 'Тип': 'Тёмная' }, { 'Текст': actionText }, { 'Иконка': false }));
  card.y = 800 - 24 - card.height;
  return card;
}

// ---------- Иконки: 20×20, линия 1.75, скруглённые концы ----------
const K = 0.5523;
function circ(cx, cy, r) {
  const k = r * K;
  return `M ${cx} ${cy - r} C ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} C ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} C ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} C ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} Z`;
}
function rrect(x, y, w, h, r) {
  const k = r * (1 - K);
  return `M ${x + r} ${y} L ${x + w - r} ${y} C ${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r} L ${x + w} ${y + h - r} C ${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} C ${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r} L ${x} ${y + r} C ${x} ${y + k} ${x + k} ${y} ${x + r} ${y} Z`;
}
const ICONS = {
  'Маршрут': [circ(5, 15, 2), circ(15, 5, 2), 'M 5 13 L 5 10 C 5 8.5 6 7.5 7.5 7.5 L 13 7.5'],
  'Пешком': [circ(11, 3.5, 1.6), 'M 9.5 7 L 8 12 L 11 14 L 11 18', 'M 8 12 L 6 17', 'M 9.5 7 L 12.5 9 L 15 8.5'],
  'Автобус': [rrect(4, 3, 12, 12, 2.5), 'M 4 10 L 16 10', 'M 6.5 15 L 6.5 17.5', 'M 13.5 15 L 13.5 17.5', 'M 8 6 L 12 6'],
  'Метро': ['M 4 15 L 4 5 L 10 12 L 16 5 L 16 15'],
  'Машина': ['M 3 13 L 3 10 L 5 6 C 5.3 5.4 5.9 5 6.6 5 L 13.4 5 C 14.1 5 14.7 5.4 15 6 L 17 10 L 17 13 Z', 'M 3 10 L 17 10', circ(6.5, 14.5, 1.5), circ(13.5, 14.5, 1.5)],
  'Парковка': [rrect(3, 3, 14, 14, 3), 'M 8 14 L 8 6 L 11.5 6 C 13 6 14 7 14 8.5 C 14 10 13 11 11.5 11 L 8 11'],
  'Дом': ['M 3 9 L 10 3 L 17 9', 'M 5 7.5 L 5 17 L 15 17 L 15 7.5', 'M 8.5 17 L 8.5 12 L 11.5 12 L 11.5 17'],
  'Работа': [rrect(3, 6, 14, 11, 2), 'M 7.5 6 L 7.5 4.5 C 7.5 4 8 3.5 8.5 3.5 L 11.5 3.5 C 12 3.5 12.5 4 12.5 4.5 L 12.5 6', 'M 3 11 L 17 11'],
  'Зал': ['M 3 8 L 3 12', 'M 5.5 6 L 5.5 14', 'M 14.5 6 L 14.5 14', 'M 17 8 L 17 12', 'M 5.5 10 L 14.5 10'],
  'Семья': ['M 10 16 C 6 13 3 10.5 3 7.5 C 3 5.5 4.5 4 6.5 4 C 8 4 9.3 5 10 6.2 C 10.7 5 12 4 13.5 4 C 15.5 4 17 5.5 17 7.5 C 17 10.5 14 13 10 16 Z'],
  'Часы': [circ(10, 10, 7), 'M 10 6 L 10 10 L 13 12'],
  'Поиск': [circ(9, 9, 5.5), 'M 13 13 L 17 17'],
  'Закладка': ['M 5 3 L 15 3 L 15 17 L 10 13 L 5 17 Z'],
  'Вход': ['M 5 17 L 5 3 L 13 3 L 13 17', 'M 3 17 L 17 17', 'M 10.5 10 L 11 10'],
  'Профиль': [circ(10, 7, 3.5), 'M 4 17 C 4 13.5 6.5 11.5 10 11.5 C 13.5 11.5 16 13.5 16 17'],
  'Назад': ['M 16 10 L 4 10', 'M 9 5 L 4 10 L 9 15'],
  'Плюс': ['M 10 4 L 10 16', 'M 4 10 L 16 10']
};
// Сдвигаем контур к (0,0), чтобы вектор встал ровно, и возвращаем смещение
function shiftPaths(paths) {
  let mx = 1e9, my = 1e9;
  paths.forEach(d => { const t = d.split(/\s+/); let xi = true; t.forEach(s => { if (/^[A-Z]$/.test(s)) { xi = true; return; } const n = +s; if (xi) mx = Math.min(mx, n); else my = Math.min(my, n); xi = !xi; }); });
  const out = paths.map(d => { const t = d.split(/\s+/); let xi = true; return t.map(s => { if (/^[A-Z]$/.test(s)) { xi = true; return s; } const n = +s - (xi ? mx : my); xi = !xi; return String(Math.round(n * 1000) / 1000); }).join(' '); });
  return { out, mx, my };
}
const IC = {};
function buildIcons(holder) {
  for (const name of Object.keys(ICONS)) {
    const full = 'Иконка / ' + name;
    let c = CP.findOne(n => n.type === 'COMPONENT' && n.name === full);
    if (!c) {
      c = figma.createComponent();
      c.name = full; c.resize(20, 20); c.fills = []; c.clipsContent = false;
      const { out, mx, my } = shiftPaths(ICONS[name]);
      const v = figma.createVector();
      v.name = 'Контур';
      v.vectorPaths = out.map(d => ({ windingRule: 'NONE', data: d }));
      v.strokes = [pv('ink')]; v.strokeWeight = 1.75; v.strokeCap = 'ROUND'; v.strokeJoin = 'ROUND'; v.fills = [];
      c.appendChild(v); v.x = mx; v.y = my;
      holder.appendChild(c);
    }
    IC[name] = c;
  }
}
async function paintFromNode(node) {
  try {
    const f = node.fills && node.fills[0];
    const id = f && f.boundVariables && f.boundVariables.color && f.boundVariables.color.id;
    if (id) { const v = await figma.variables.getVariableByIdAsync(id); if (v) return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', v); }
  } catch (e) { }
  return pv('ink');
}
function tint(node, paint) { node.findAll(n => n.type === 'VECTOR').forEach(v => { v.strokes = [paint]; }); }
// Меняем кружок «Иконка» на экземпляр иконки, сохраняя видимость-свойство и цвет
async function swapEllipse(el, icon, swapKey) {
  const parent = el.parent;
  const idx = parent.children.indexOf(el);
  const paint = await paintFromNode(el);
  const refs = Object.assign({}, el.componentPropertyReferences || {});
  const i = icon.createInstance();
  i.name = 'Иконка';
  parent.insertChild(idx, i);
  tint(i, paint);
  if (swapKey) refs.mainComponent = swapKey;
  if (Object.keys(refs).length) i.componentPropertyReferences = refs;
  el.remove();
  return i;
}
async function upgradeOwner(owner, pickIcon, withSwap) {
  if (!owner) return null;
  const variants = owner.type === 'COMPONENT_SET' ? owner.children : [owner];
  let swapKey = null;
  if (withSwap) {
    swapKey = pkey(owner, 'Иконка · вид');
    if (!swapKey) swapKey = owner.addComponentProperty('Иконка · вид', 'INSTANCE_SWAP', pickIcon(null).id);
  }
  for (const v of variants) {
    const el = v.findOne(n => n.type === 'ELLIPSE' && n.name === 'Иконка');
    if (el) await swapEllipse(el, pickIcon(v), swapKey);
  }
  return swapKey;
}

// ---------- Иконки концепта «Без машины» ----------
Object.assign(ICONS, {
  'Дождь': ['M 6 12 C 3.8 12 3 10.5 3 9.3 C 3 7.6 4.4 6.3 6 6.5 C 6.6 4.5 8.3 3 10.5 3 C 13.3 3 15.3 5.2 15.2 7.6 C 16.8 7.8 17.5 9 17.5 10 C 17.5 11.2 16.6 12 15.2 12 Z', 'M 7 14.5 L 6 17', 'M 10.5 14.5 L 9.5 17', 'M 14 14.5 L 13 17'],
  'Колокол': ['M 5 14 L 5 9 C 5 6 7.2 3.8 10 3.8 C 12.8 3.8 15 6 15 9 L 15 14 L 16.5 15.5 L 3.5 15.5 Z', 'M 8.5 17.5 L 11.5 17.5'],
  'Аптека': [rrect(3, 3, 14, 14, 3), 'M 10 6.5 L 10 13.5', 'M 6.5 10 L 13.5 10'],
  'Кофе': ['M 4 8 L 14 8 L 13 15 C 12.9 16.1 12 17 10.9 17 L 7.1 17 C 6 17 5.1 16.1 5 15 Z', 'M 14 9.5 L 15.5 9.5 C 16.6 9.5 17 10.3 17 11 C 17 11.8 16.4 12.5 15.5 12.5 L 13.6 12.5', 'M 8 3 L 8 5.5', 'M 11 3 L 11 5.5'],
  'Здание': [rrect(4, 3, 12, 14, 1.5), 'M 7.5 7 L 8.5 7', 'M 11.5 7 L 12.5 7', 'M 7.5 10.5 L 8.5 10.5', 'M 11.5 10.5 L 12.5 10.5', 'M 9 17 L 9 14 L 11 14 L 11 17'],
  'Навигатор': ['M 10 2.5 L 16 17 L 10 13.5 L 4 17 Z']
});


// ================= Прогноз v2 =================
let PG;
const ST_FX = {};
async function loadEffects() {
  const ex = await figma.getLocalEffectStylesAsync();
  for (const n of ['ГИС/Карточка на светлом', 'ГИС/Уровень 1', 'ГИС/Уровень 3']) { const s = ex.find(x => x.name === n); if (s) ST_FX[n] = s; }
}
async function fx(node, name) { if (ST_FX[name]) { try { await node.setEffectStyleIdAsync(ST_FX[name].id); } catch (e) { } } }
// Горизонтальный ряд фиксированной ширины: высота по содержимому (не 10 px, как у AL с w)
function ROW(parent, o) {
  const f = AL(parent, 'HORIZONTAL', Object.assign({}, o, { w: null }));
  if (o.w) { f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'AUTO'; f.resize(o.w, f.height || 10); }
  return f;
}
function phone(name, i) {
  const s = figma.createFrame();
  s.name = name; s.resize(360, 800); s.cornerRadius = 28; s.clipsContent = true; s.fills = [pv('soft')];
  PG.appendChild(s); s.x = i * 440; s.y = 0;
  return s;
}
function icoInst(name, color) { const i = IC[name].createInstance(); tint(i, pv(color)); return i; }
// Экран-лента: в прототипе прокручивается по вертикали, сам кадр остаётся 360×800
function scrollable(s, list) { list.paddingBottom = 24; s.overflowDirection = 'VERTICAL'; }
let LAST_TIME_CHIP = null;
async function header(s, small, title, sub, extra, timeChip) {
  LAST_TIME_CHIP = null;
  const h = AL(s, 'VERTICAL', { name: 'Шапка', gap: 4, px: 20, w: 360, bg: 'bg', x: 0, y: 0 });
  h.paddingTop = 40; h.paddingBottom = 20;
  await TX(h, small, 'small', 'lav', { fill: true });
  if (timeChip) {
    const row = AL(h, 'HORIZONTAL', { name: 'Заголовок', gap: 8, align: 'CENTER' });
    await TX(row, title, 'title', 'white');
    const chip = AL(row, 'HORIZONTAL', { name: 'Кнопка времени', gap: 4, px: 10, py: 2, r: 10, bg: 'glass', align: 'CENTER' });
    await TX(chip, timeChip + ' ▾', 'title', 'white');
    await fx(chip, 'ГИС/Уровень 1');
    LAST_TIME_CHIP = chip;
  } else await TX(h, title, 'title', 'white', { fill: true });
  if (sub) await TX(h, sub, 'cap', 'lav', { fill: true });
  if (extra) { const r = AL(h, 'HORIZONTAL', { name: 'Погода', gap: 6, align: 'CENTER' }); r.appendChild(icoInst('Дождь', 'lav')); await TX(r, extra, 'cap', 'lav'); }
  await TX(s, '8:20', 'small', 'white', { x: 20, y: 10, name: 'Статус-бар' });
  return h;
}
// Текст пишем прямо в экземпляр, иконку прячем: так работает, даже если Figma не даёт менять свойства набора
async function pillC(type, text) {
  const i = inst(LIB['Пилюля'], { 'Тип': type }, { 'Текст': text }, { 'Иконка': false });
  const t = i.findOne(n => n.type === 'TEXT');
  if (t) { try { await figma.loadFontAsync(t.fontName); t.characters = text; } catch (e) { SET_ISSUES.add('текст пилюли: ' + e.message); } }
  i.findAll(n => n.type !== 'TEXT' && n.name === 'Иконка').forEach(n => { try { n.visible = false; } catch (e) { } });
  i.name = text;
  return i;
}

// Цвета итога: зелёный — надёжно, оранжевый — риск, розовый — не успеешь
const VERDICT = {
  'Надёжно': ['limeP', 'limeT'], 'Стабильно': ['limeP', 'limeT'],
  'Есть риск': ['orange', 'orangeT'], 'Зависит от пробок': ['orange', 'orangeT'],
  'Скорее опоздаешь': ['orange', 'orangeT'], 'Не успеешь': ['pinkL', 'pinkT']
};
const LATE = { 'Скорее опоздаешь': 1, 'Не успеешь': 1 };

// ---------- Компонент «Карточка варианта» ----------
async function buildCard() {
  const ex = LIB.find('Карточка варианта');
  if (ex) { await migrateCard(ex); return ex; }
  const comps = [];
  for (const v of Object.keys(VERDICT)) for (const sel of [false, true]) {
    const c = compAL('Итог=' + v + ', Состояние=' + (sel ? 'Выбрана' : 'Обычная'), 'VERTICAL', { px: 14, py: 12, gap: 10, r: 16, bg: 'white', stroke: sel ? 'accent' : 'line', sw: sel ? 2 : 1 });
    c.counterAxisSizingMode = 'FIXED'; c.resize(328, 100); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisAlignItems = 'MIN';
    const top = ROW(c, { name: 'Верх', gap: 12, align: 'CENTER' }); top.layoutSizingHorizontal = 'FILL';
    const box = AL(top, 'HORIZONTAL', { name: 'Плашка иконки', r: 12, bg: 'lav', align: 'CENTER', justify: 'CENTER' });
    box.primaryAxisSizingMode = 'FIXED'; box.counterAxisSizingMode = 'FIXED'; box.resize(36, 36);
    const ic = icoInst('Метро', 'lavT'); ic.name = 'Иконка'; box.appendChild(ic);
    const info = AL(top, 'VERTICAL', { name: 'Инфо', gap: 2 }); info.layoutGrow = 1;
    await TX(info, 'Метро', 'bodyM', 'ink', { name: 'Название' });
    const d = await TX(info, '5 остановок · ≈ 70 ₽', 'small', 'mute', { name: 'Детали', fill: true });
    const right = AL(top, 'VERTICAL', { name: 'Прибытие', gap: 0, align: 'MAX' });
    const big = await TX(right, '8:48', 'big', LATE[v] ? 'pinkT' : 'ink', { name: 'Время прибытия' });
    await TX(right, 'запас 12 мин', 'small', LATE[v] ? 'pinkT' : 'mute', { name: 'Запас' });
    const pills = AL(c, 'HORIZONTAL', { name: 'Пилюли', gap: 6, wrap: true }); pills.layoutSizingHorizontal = 'FILL'; pills.primaryAxisSizingMode = 'FIXED';
    const [bg, fg] = VERDICT[v];
    const p1 = AL(pills, 'HORIZONTAL', { name: 'Пилюля: итог', px: 10, py: 4, r: 12, bg }); await TX(p1, v.toLowerCase(), 'small', fg, { name: 'Итог · текст' });
    const p2 = AL(pills, 'HORIZONTAL', { name: 'Пилюля: самое позднее', px: 10, py: 4, r: 12, bg: 'soft' }); await TX(p2, 'самое позднее 8:51', 'small', 'ink', { name: 'Самое позднее' });
    const p3 = AL(pills, 'HORIZONTAL', { name: 'Пилюля: выйти до', px: 10, py: 4, r: 12, bg: 'soft' }); await TX(p3, 'можно выйти до 8:29', 'small', 'ink', { name: 'Выйти до' });
    CP.appendChild(c); comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Карточка варианта', 'HORIZONTAL'); set.layoutWrap = 'WRAP'; set.counterAxisSpacing = 16; set.primaryAxisSizingMode = 'FIXED'; set.resize(2 * 328 + 3 * 20, set.height);
  bindTexts(set, [['Название', 'Метро'], ['Детали', '5 остановок · ≈ 70 ₽'], ['Время прибытия', '8:48'], ['Запас', 'запас 12 мин'], ['Итог · текст', 'надёжно'], ['Самое позднее', 'самое позднее 8:51'], ['Выйти до', 'можно выйти до 8:29']]);
  const bKey = set.addComponentProperty('Показать «выйти до»', 'BOOLEAN', true);
  const sKey = set.addComponentProperty('Иконка · вид', 'INSTANCE_SWAP', IC['Метро'].id);
  for (const c of set.children) {
    const p3 = c.findOne(n => n.name === 'Пилюля: выйти до'); if (p3) p3.componentPropertyReferences = { visible: bKey };
    const ic = c.findOne(n => n.name === 'Иконка' && n.type === 'INSTANCE'); if (ic) ic.componentPropertyReferences = { mainComponent: sKey };
    await fx(c, 'ГИС/Карточка на светлом');
  }
  const bottom = CP.children.filter(n => n !== set).reduce((mx, n) => Math.max(mx, n.y + n.height), 0);
  set.x = 0; set.y = bottom + 48;
  return set;
}
let CARD;
// Обновление уже созданной карточки: «Плохой день» → «Самое позднее» (решение 22.11)
async function migrateCard(set) {
  let defs = {}; try { defs = set.componentPropertyDefinitions; } catch (e) { return; }
  const old = Object.keys(defs).find(k => k.split('#')[0] === 'Плохой день');
  if (old) { try { set.editComponentProperty(old, { name: 'Самое позднее', defaultValue: 'самое позднее 8:51' }); } catch (e) { SET_ISSUES.add('карточка: ' + e.message); } }
  for (const c of set.children) {
    const t = c.findOne(n => n.type === 'TEXT' && (n.name === 'Плохой день' || n.name === 'Самое позднее'));
    if (t) { t.name = 'Самое позднее'; try { await figma.loadFontAsync(t.fontName); if (/плохой день/.test(t.characters)) t.characters = t.characters.replace('в плохой день', 'самое позднее'); } catch (e) { } }
    const f = c.findOne(n => n.name === 'Пилюля: плохой день'); if (f) f.name = 'Пилюля: самое позднее';
  }
}
// Починка набора: одинаковые варианты — ошибка набора. Лишний вариант без экземпляров удаляем, с экземплярами — переименовываем.
async function repairSet(set) {
  const groups = {}; let removed = 0, renamed = 0;
  for (const c of set.children) (groups[c.name] = groups[c.name] || []).push(c);
  for (const [n, arr] of Object.entries(groups)) {
    for (let i = 1; i < arr.length; i++) {
      const c = arr[i]; let used = 0;
      try { used = (await c.getInstancesAsync()).length; } catch (e) { used = 0; }
      if (!used) { c.remove(); removed++; }
      else { c.name = /Нажатие=/.test(n) ? n.replace(/Нажатие=([^,]+)/, 'Нажатие=$1 ' + (i + 1)) : n + ', Копия=' + (i + 1); renamed++; }
    }
  }
  return { removed, renamed };
}
function card(parent, o) {
  const i = inst(CARD, { 'Итог': o.v, 'Состояние': o.sel ? 'Выбрана' : 'Обычная' },
    { 'Название': o.n, 'Детали': o.d, 'Время прибытия': o.t, 'Запас': o.z, 'Итог · текст': o.v.toLowerCase(), 'Самое позднее': o.bad, 'Выйти до': o.until || '' },
    { 'Показать «выйти до»': !!o.until });
  const k = pkey(CARD, 'Иконка · вид'); if (k) i.setProperties({ [k]: IC[o.ic].id });
  i.name = 'Вариант: ' + o.n;
  parent.appendChild(i); i.layoutSizingHorizontal = 'FILL';
  return i;
}

// ---------- Переключатели ----------
function seg(parent, labels, act, name) {
  const s = ROW(parent, { name: name || 'Переключатель', pad: 3, r: 12, bg: 'lav', gap: 0 });
  s.layoutSizingHorizontal = 'FILL';
  const btns = [];
  labels.forEach((l, i) => {
    const b = AL(s, 'HORIZONTAL', { name: l, px: 8, py: 8, r: 10, bg: i === act ? 'white' : null, align: 'CENTER', justify: 'CENTER' });
    b.layoutGrow = 1; btns.push(b);
  });
  return { s, btns };
}
async function segText(sg, labels, act) { for (let i = 0; i < labels.length; i++) await TX(sg.btns[i], labels[i], i === act ? 'bodyM' : 'body', i === act ? 'ink' : 'lavT'); }
async function controls(s, y) {
  const box = AL(s, 'VERTICAL', { name: 'Управление', gap: 10, w: 360, px: 16, x: 0, y });
  const m = seg(box, ['Тороплюсь', 'Гуляю'], 0, 'Режим'); await segText(m, ['Тороплюсь', 'Гуляю'], 0);
  return { box };
}
async function timeChips(parent, mode) {
  const chips = AL(parent, 'HORIZONTAL', { name: 'Время: быстрый выбор', gap: 6, wrap: true }); chips.layoutSizingHorizontal = 'FILL'; chips.primaryAxisSizingMode = 'FIXED';
  const list = mode === 'arrive' ? ['8:30', '9:00', '9:30', '10:00'] : ['Сейчас', '8:30', '8:45', '9:00'];
  const on = mode === 'arrive' ? '9:00' : '8:45';
  for (const l of list) chips.appendChild(await pillC(l === on ? 'Активная' : 'Обычная', l));
  return chips;
}

// ---------- Экраны ----------
async function p1() {
  const s = phone('P1 · Как успеть к 9:00', 0);
  const h = await header(s, 'Первомайская ул., 100 → м. Бауманская', 'Как успеть к', 'Сейчас 8:20', 'Дождь с 8:40', '9:00');
  const chipP1 = LAST_TIME_CHIP;
  const c = await controls(s, h.height + 12);
  const list = AL(s, 'VERTICAL', { name: 'Способы', gap: 8, w: 360, px: 16, x: 0, y: c.box.y + c.box.height + 12 });
  const O = [
    { n: 'Метро', ic: 'Метро', d: '5 остановок · ≈ 70 ₽', t: '8:48', z: 'запас 12 мин', v: 'Надёжно', bad: 'самое позднее 8:51', until: 'можно выйти до 8:29', sel: true },
    { n: 'Такси', ic: 'Машина', d: 'подача 3–9 мин · ≈ 650 ₽', t: '8:53', z: 'запас 7 мин', v: 'Надёжно', bad: 'самое позднее 9:00', until: 'можно выйти до 8:20' },
    { n: 'Каршеринг', ic: 'Машина', d: 'машина в 360 м · ≈ 400 ₽', t: '9:01', z: 'опоздание ~1 мин', v: 'Скорее опоздаешь', bad: 'успеешь, только если повезёт' },
    { n: 'Пешком', ic: 'Пешком', d: '≈ 10 км · бесплатно', t: '10:23', z: 'опоздание ~1 ч 23 мин', v: 'Не успеешь', bad: 'дождь с 8:40 — нужен зонт' }
  ];
  const cards = []; for (const o of O) cards.push(card(list, o));
  scrollable(s, list);
  return { s, other: chipP1, metro: cards[0], carshare: cards[2] };
}
async function p2() {
  const s = phone('P2 · Если выйти в 8:45', 1);
  const h = await header(s, 'Первомайская ул., 100 → м. Бауманская', 'Если выйти', 'Сейчас 8:20', 'Дождь с 8:40', 'в 8:45');
  const chipP2 = LAST_TIME_CHIP;
  const c = await controls(s, h.height + 12);
  const list = AL(s, 'VERTICAL', { name: 'Способы', gap: 8, w: 360, px: 16, x: 0, y: c.box.y + c.box.height + 12 });
  const O = [
    { n: 'Метро', ic: 'Метро', d: '5 остановок · ≈ 70 ₽', t: '9:13', z: 'в пути ~28 мин', v: 'Стабильно', bad: 'самое позднее 9:16', sel: true },
    { n: 'Такси', ic: 'Машина', d: 'подача 3–9 мин · ≈ 650 ₽', t: '9:18', z: 'в пути ~33 мин', v: 'Зависит от пробок', bad: 'самое позднее 9:25' },
    { n: 'Каршеринг', ic: 'Машина', d: 'машина в 360 м · ≈ 400 ₽', t: '9:26', z: 'в пути ~41 мин', v: 'Зависит от пробок', bad: 'самое позднее 9:33' },
    { n: 'Пешком', ic: 'Пешком', d: '≈ 10 км · бесплатно', t: '10:48', z: 'в пути ~2 ч 3 мин', v: 'Стабильно', bad: 'самое позднее 10:56' }
  ];
  for (const o of O) card(list, o);
  scrollable(s, list);
  return { s, other: chipP2 };
}
async function p3() {
  const s = phone('P3 · Когда? (шторка)', 2);
  const h = await header(s, 'Первомайская ул., 100 → м. Бауманская', 'Как успеть к', 'Сейчас 8:20', null, '9:00');
  const dim = figma.createRectangle(); dim.name = 'Затемнение'; dim.resize(360, 800); dim.fills = [pv('ink')]; dim.opacity = 0.35; s.appendChild(dim);
  const sheet = AL(s, 'VERTICAL', { name: 'Шторка: время', gap: 14, w: 360, px: 16, r: 24, bg: 'soft', x: 0, y: 190 });
  sheet.paddingTop = 12; sheet.paddingBottom = 24; sheet.bottomLeftRadius = 0; sheet.bottomRightRadius = 0;
  await fx(sheet, 'ГИС/Уровень 3');
  const grab = figma.createRectangle(); grab.name = 'Ручка'; grab.resize(44, 5); grab.cornerRadius = 3; grab.fills = [pv('dash')]; sheet.appendChild(grab); grab.layoutAlign = 'CENTER';
  await TX(sheet, 'Когда?', 'title', 'ink');
  const box = sheet;
  const t = seg(box, ['Прибыть к', 'Выйти в'], 0, 'Время: режим'); await segText(t, ['Прибыть к', 'Выйти в'], 0);
  await timeChips(box, 'arrive');
  const wheel = figma.createFrame(); wheel.name = 'Колесо'; wheel.resize(328, 230); wheel.cornerRadius = 20; wheel.fills = [pv('white')]; wheel.clipsContent = true;
  box.appendChild(wheel); await fx(wheel, 'ГИС/Карточка на светлом');
  const lens = figma.createRectangle(); lens.name = 'Линза'; lens.resize(296, 48); lens.cornerRadius = 14; lens.fills = [pv('lav')]; wheel.appendChild(lens); lens.x = 16; lens.y = 91;
  const H = ['7', '8', '9', '10', '11'], M = ['50', '55', '00', '05', '10'];
  for (let i = 0; i < 5; i++) {
    const op = [0.25, 0.5, 1, 0.5, 0.25][i], y = 20 + i * 40 - (i === 2 ? 3 : 0);
    const a = await TX(wheel, H[i], i === 2 ? 'title' : 'big', 'ink', { x: 0, y, name: 'Час ' + H[i] }); a.textAlignHorizontal = 'RIGHT'; a.resize(130, a.height); a.textAutoResize = 'HEIGHT'; a.opacity = op; if (i === 2) a.fontSize = 28;
    const b = await TX(wheel, M[i], i === 2 ? 'title' : 'big', 'ink', { x: 198, y, name: 'Минуты ' + M[i] }); b.opacity = op; if (i === 2) b.fontSize = 28;
  }
  const colon = await TX(wheel, ':', 'title', 'ink', { x: 160, y: 96, name: 'Двоеточие' }); colon.fontSize = 28;
  await TX(box, 'Прибыть к 9:00 — прогноз покажет, когда выйти', 'cap', 'mute', { fill: true });
  const done = await pillC('Тёмная', 'Готово'); box.appendChild(done); done.layoutSizingHorizontal = 'FILL';
  sheet.y = 800 - sheet.height;
  return { s, done };
}
async function route(i, name, small, title, sub, verdict, bad, steps, idx) {
  const s = phone(name, i);
  const h = await header(s, small, title, sub);
  const pr = AL(s, 'HORIZONTAL', { name: 'Итог', gap: 6, x: 16, y: h.height + 12 });
  const [bg, fg] = VERDICT[verdict];
  const a = AL(pr, 'HORIZONTAL', { name: 'Пилюля: итог', px: 10, py: 4, r: 12, bg }); await TX(a, verdict.toLowerCase(), 'small', fg);
  const b = AL(pr, 'HORIZONTAL', { name: 'Пилюля: самое позднее', px: 10, py: 4, r: 12, bg: 'white' }); await TX(b, bad, 'small', 'ink');
  let y = pr.y + pr.height + 30;
  const step = 92;
  for (let k = 0; k < steps.length; k++) {
    const st = steps[k];
    if (k < steps.length - 1) L(s, [[28, y + 8], [28, y + step - 6]], st.c, 3, { dash: st.dash ? [2, 6] : null, name: 'Линия шага' });
    EL(s, 28, y, 6, 6, { fill: 'white', stroke: st.c === 'dash' ? 'mute' : st.c, sw: 2.5, name: 'Точка шага' });
    await TX(s, st.t, 'bodyM', 'ink', { x: 48, y: y - 10, name: 'Шаг' });
    await TX(s, st.m, 'small', 'mute', { x: 48, y: y + 10, name: 'Время шага' });
    if (st.l) {
      const chip = AL(s, 'HORIZONTAL', { name: 'Ориентир', gap: 6, px: 10, py: 6, r: 10, bg: 'lav', align: 'CENTER', x: 48, y: y + 30 });
      chip.appendChild(icoInst(st.ic, 'accent'));
      const tx = await TX(chip, st.l, 'small', 'accent');
      if (chip.width > 296) { chip.primaryAxisSizingMode = 'FIXED'; chip.resize(296, chip.height); tx.layoutGrow = 1; tx.textAutoResize = 'HEIGHT'; }
    }
    y += step;
  }
  const row = ROW(s, { name: 'Кнопки', gap: 8, w: 328, x: 16, y: 800 - 24 - 40 });
  const other = await pillC('Кнопка', 'Другой способ'), go = await pillC('Тёмная', idx === 'car' ? 'Забронировать' : 'Поехали');
  row.appendChild(other); row.appendChild(go); other.layoutSizingHorizontal = 'FILL'; go.layoutSizingHorizontal = 'FILL';
  return { s, other };
}
async function p4() {
  return route(3, 'P4 · Маршрут: метро', 'Метро · прибыть к 9:00', 'Выходи до 8:29', 'Выйдешь сейчас — будешь в 8:48, самое позднее 8:51. Запас 12 мин', 'Надёжно', 'самое позднее 8:51', [
    { c: 'dash', dash: true, t: 'Пешком до м. Первомайская', m: '8:20 · ~11 мин (обычно 9–13)', ic: 'Вход', l: 'Вход №3 — на южной стороне улицы' },
    { c: 'bg', t: 'Турникеты и поезд', m: '8:31 · ~2 мин (обычно 1–4)', ic: 'Часы', l: 'В час пик поезда раз в 2–3 минуты' },
    { c: 'bg', t: 'Метро до Бауманской · 5 остановок', m: '8:33 · ~13 мин (обычно 12–15)', ic: 'Колокол', l: 'Перед выходом — вибрация' },
    { c: 'dash', dash: true, t: 'Подъём в город', m: '8:46 · ~2 мин', ic: 'Здание', l: 'Выход на Бауманской один' }
  ], 'metro');
}
async function p5() {
  return route(4, 'P5 · Маршрут: каршеринг', 'Каршеринг · прибыть к 9:00', 'Выходи сейчас — скорее опоздаешь', 'Обычно будешь в 9:01, успеешь, только если повезёт', 'Скорее опоздаешь', 'надёжнее — метро', [
    { c: 'dash', dash: true, t: 'Пешком до машины', m: '8:20 · ~5 мин (обычно 4–6)', ic: 'Машина', l: 'Ближайшая свободная машина — 360 м' },
    { c: 'bg', t: 'Открыть машину и выехать', m: '8:25 · ~2 мин', ic: 'Часы', l: 'Осмотр и фото — пока идёшь' },
    { c: 'orange', t: 'За рулём до Бауманской', m: '8:27 · ~28 мин (обычно 22–36)', ic: 'Навигатор', l: 'Утренние пробки: возможна задержка' },
    { c: 'dash', dash: true, t: 'Парковка и пешком до входа', m: '8:55 · ~6 мин (обычно 4–9)', ic: 'Парковка', l: 'Завершай аренду только в разрешённой зоне' }
  ], 'car');
}

(async () => {
  await Promise.all([figma.loadFontAsync({ family: 'Inter', style: 'Regular' }), figma.loadFontAsync({ family: 'Inter', style: 'Medium' })]);
  await setupVariables(); await setupTextStyles(); await loadLibrary(); await loadEffects();
  await figma.setCurrentPageAsync(CP);
  let holder = CP.findOne(n => n.type === 'FRAME' && n.name === 'Иконки');
  const bottom0 = CP.children.reduce((mx, n) => Math.max(mx, n.y + n.height), 0);
  if (!holder) holder = AL(CP, 'HORIZONTAL', { name: 'Иконки', gap: 16, pad: 20, r: 16, bg: 'white', align: 'CENTER', x: 0, y: bottom0 + 48 });
  buildIcons(holder);
  const fix = await repairSet(LIB['Пилюля']);
  CARD = await buildCard();

  const base = 'ГИС · Прогноз v2';
  let name = base, k = 2; while (figma.root.children.some(p => p.name === name)) name = base + ' (' + (k++) + ')';
  PG = figma.createPage(); PG.name = name;
  await figma.setCurrentPageAsync(PG);
  const A = await p1(), B = await p2(), C = await p3(), D = await p4(), E = await p5();
  for (const f of [A.s, B.s, C.s, D.s, E.s]) await TX(PG, f.name, 'big', 'ink', { x: f.x, y: -36 });
  const GO = id => ({ type: 'NODE', destinationId: id, navigation: 'NAVIGATE', transition: { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.3 }, preserveScrollPosition: false });
  const link = async (n, a) => { if (n) await n.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [a] }]); };
  await link(A.metro, GO(D.s.id)); await link(A.carshare, GO(E.s.id));
  await link(A.other, GO(C.s.id)); await link(B.other, GO(C.s.id));
  await link(C.done, { type: 'BACK' }); await link(D.other, { type: 'BACK' }); await link(E.other, { type: 'BACK' });
  PG.flowStartingPoints = [{ nodeId: A.s.id, name: 'Прогноз v2' }];
  figma.viewport.scrollAndZoomIntoView([A.s, B.s, C.s, D.s, E.s]);
  const fixed = fix.removed || fix.renamed ? ' · «Пилюля» починена: удалено ' + fix.removed + ', переименовано ' + fix.renamed : '';
  const warn = SET_ISSUES.size ? ' · ⚠ ' + [...SET_ISSUES].slice(0, 2).join('; ') : '';
  figma.closePlugin('Готово: «' + name + '» — 5 экранов и компонент «Карточка варианта» (6 итогов × выбрана/обычная)' + fixed + warn);
})().catch(e => figma.closePlugin('Ошибка: ' + (e && e.message ? e.message : e)));
