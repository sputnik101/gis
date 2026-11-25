// Своя ГИС — прогноз v4 (этап 2: метро по интервалам, плашки, без дублей итога). Было: прогноз v3 (после проверки 2): время прибытия и запас, «самое позднее», итог цветом; выбор времени (Прибыть к / Выйти в / колесо).
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
    const c = compAL('Состояние=' + (sel ? 'Выбран' : 'Обычный'), 'HORIZONTAL', { w: 272, h: 60, px: 12, py: 12, gap: 12, r: 14, bg: sel ? 'lav' : null, stroke: sel ? 'accent' : null });
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
    const c = compAL('Тон=' + t, 'HORIZONTAL', { px: 8, py: 4, r: 10, bg });
    await TX(c, 'успеешь', 'tiny', fg, { name: 'Текст' });
    comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Бейдж');
  bindTexts(set, [['Текст', 'успеешь']]);
  return set;
}
async function buildTemplateChip() {
  const c = compAL('Чип шаблона', 'HORIZONTAL', { px: 12, py: 8, gap: 8, r: 14, bg: 'lav' });
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
  sb.paddingLeft = sb.paddingRight = 24; sb.paddingTop = 28; sb.paddingBottom = 28; sb.itemSpacing = 12;
  sb.fills = [pv('white')];
  s.appendChild(sb); sb.x = 0; sb.y = 0;
  return { s, sb };
}
let RES, PIN, CAT, BADGE, TCHIP;
async function searchHeader(sb, query) {
  const f = AL(sb, 'HORIZONTAL', { name: 'Поиск', gap: 8, px: 16, py: 12, r: 20, stroke: 'line', align: 'CENTER', fill: true });
  const i = figma.createEllipse(); i.name = 'Иконка'; i.resize(16, 16); i.fills = [pv('mute')]; i.opacity = 0.3; f.appendChild(i);
  await TX(f, query, 'body', 'ink', { name: 'Запрос' });
  const cats = AL(sb, 'HORIZONTAL', { name: 'Категории', gap: 8, wrap: true, fill: true });
  ['Кофе', 'Поесть', 'Аптека', 'Продукты', 'АЗС'].forEach((c, k) => put(cats, inst(CAT, { 'Состояние': k === 0 ? 'Вкл' : 'Выкл' }, { 'Текст': c })));
}
function segment(parent, labels, act) {
  const f = AL(parent, 'HORIZONTAL', { name: 'Переключатель', pad: 4, r: 20, bg: 'soft', fill: true });
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
  const card = AL(map, 'HORIZONTAL', { name: 'Карточка места', gap: 12, px: 16, py: 16, r: 22, bg: 'white', align: 'CENTER', x: 24, y: 700 });
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
  'Навигатор': ['M 10 2.5 L 16 17 L 10 13.5 L 4 17 Z'],
  'Внимание': ['M 10 3 L 17.5 16.5 L 2.5 16.5 Z', 'M 10 8 L 10 11.5', 'M 10 14 L 10 14.1'],
  'Галочка': ['M 4 10.5 L 8 14.5 L 16 5.5'],
  'Шаги': ['M 6 17 C 4.5 17 4 15.5 4.2 14 C 4.5 12 5.5 11 6.5 11 C 7.5 11 8 12.2 7.8 14 C 7.6 15.8 7.2 17 6 17 Z', 'M 13.5 9 C 12.3 9 11.8 7.7 12 6.2 C 12.3 4.2 13.3 3 14.3 3 C 15.3 3 15.8 4.3 15.6 6 C 15.4 7.8 14.7 9 13.5 9 Z']
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
    const chip = AL(row, 'HORIZONTAL', { name: 'Кнопка времени', gap: 4, px: 12, py: 2, r: 10, bg: 'glass', align: 'CENTER' });
    await TX(chip, timeChip + ' ▾', 'title', 'white');
    await fx(chip, 'ГИС/Уровень 1');
    LAST_TIME_CHIP = chip;
  } else await TX(h, title, 'title', 'white', { fill: true });
  if (sub) await TX(h, sub, 'cap', 'lav', { fill: true });
  if (extra) { const r = AL(h, 'HORIZONTAL', { name: 'Погода', gap: 8, align: 'CENTER' }); r.appendChild(icoInst('Дождь', 'lav')); await TX(r, extra, 'cap', 'lav'); }
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


// ---------- Компонент «Карточка варианта · v2» (проверка 2, 22.11) ----------
// Справа — главный ответ: «выйди до / 8:27 / ещё 7 мин», «выходи / сейчас / будешь ~8:54» или «будешь в / 9:14 / самое позднее 9:18».
// Цвета итога: зелёный — надёжно/стабильно, оранжевый — риск, красный — опоздание.
const V2 = {
  'Надёжно': 'g', 'Стабильно': 'g', 'Есть риск': 'a', 'Риск из-за пробок': 'a', 'Зависит от пробок': 'a', 'Бывает дольше': 'a',
  'Скорее опоздаешь': 'r', 'Не успеешь': 'r'
};
const PILLC = { g: ['limeP', 'limeT'], a: ['orange', 'orangeT'], r: ['pinkL', 'pinkT'], n: ['lav', 'lavT'] };   // n — лаванда: на белой карточке не сливается
async function recolor(frame, cls) {
  if (!frame) return; const [bg, fg] = PILLC[cls] || PILLC.n;
  try { frame.fills = [pv(bg)]; } catch (e) { }
  const t = frame.findOne(n => n.type === 'TEXT'); if (t) { try { t.fills = [pv(fg)]; } catch (e) { } }
}
async function buildCard2() {
  const ex = LIB.find('Карточка варианта · v2');
  if (ex) return ex;
  const comps = [];
  for (const v of Object.keys(V2)) for (const sel of [false, true]) {
    const cls = V2[v], never = v === 'Не успеешь';
    const c = compAL('Итог=' + v + ', Выбрана=' + (sel ? 'Да' : 'Нет'), 'VERTICAL', { px: 16, py: 12, gap: 12, r: 16, bg: never ? 'soft' : 'white', stroke: sel ? 'accent' : 'line', sw: sel ? 2 : 1 });
    c.counterAxisSizingMode = 'FIXED'; c.resize(328, 100); c.primaryAxisSizingMode = 'AUTO'; c.counterAxisAlignItems = 'MIN'; c.clipsContent = false;
    const best = AL(c, 'HORIZONTAL', { name: 'Лучше всего', px: 8, py: 2, r: 8, bg: 'dark' }); await TX(best, 'Лучше всего', 'tiny', 'white', { name: 'Метка' });
    const top = ROW(c, { name: 'Верх', gap: 12, align: 'CENTER' }); top.layoutSizingHorizontal = 'FILL';
    const box = AL(top, 'HORIZONTAL', { name: 'Плашка иконки', r: 12, bg: 'lav', align: 'CENTER', justify: 'CENTER' });
    box.primaryAxisSizingMode = 'FIXED'; box.counterAxisSizingMode = 'FIXED'; box.resize(36, 36);
    const ic = icoInst('Метро', 'lavT'); ic.name = 'Иконка'; box.appendChild(ic);
    const info = AL(top, 'VERTICAL', { name: 'Инфо', gap: 2 }); info.layoutGrow = 1;
    await TX(info, 'Метро', 'bodyM', 'ink', { name: 'Название' });
    await TX(info, '5 остановок без пересадок · ≈ 70 ₽', 'small', 'mute', { name: 'Детали', fill: true });
    const right = AL(top, 'VERTICAL', { name: 'Ответ', gap: 0, align: 'MAX' });
    await TX(right, 'выйди до', 'small', 'mute', { name: 'Подпись сверху' });
    await TX(right, '8:27', 'big', 'ink', { name: 'Главное' });
    await TX(right, 'ещё 7 мин', 'small', 'mute', { name: 'Подпись снизу' });
    const pills = AL(c, 'HORIZONTAL', { name: 'Пилюли', gap: 8, wrap: true }); pills.layoutSizingHorizontal = 'FILL'; pills.primaryAxisSizingMode = 'FIXED';
    const [bg, fg] = PILLC[cls];
    const p1 = AL(pills, 'HORIZONTAL', { name: 'Пилюля: итог', px: 12, py: 4, r: 12, bg }); await TX(p1, v.toLowerCase(), 'small', fg, { name: 'Итог · текст' });
    const p2 = AL(pills, 'HORIZONTAL', { name: 'Пилюля 2', px: 12, py: 4, r: 12, bg: 'soft' }); await TX(p2, 'в пути ~29 мин', 'small', 'ink', { name: 'Пилюля 2 · текст' });
    const p3 = AL(pills, 'HORIZONTAL', { name: 'Пилюля 3', px: 12, py: 4, r: 12, bg: 'soft' }); await TX(p3, 'нужен зонт', 'small', 'ink', { name: 'Пилюля 3 · текст' });
    CP.appendChild(c); comps.push(c);
  }
  const set = figma.combineAsVariants(comps, CP);
  tidySet(set, 'Карточка варианта · v2', 'HORIZONTAL'); set.layoutWrap = 'WRAP'; set.counterAxisSpacing = 24; set.primaryAxisSizingMode = 'FIXED'; set.resize(2 * 328 + 3 * 20, set.height);
  bindTexts(set, [['Название', 'Метро'], ['Детали', '5 остановок без пересадок · ≈ 70 ₽'], ['Подпись сверху', 'выйди до'], ['Главное', '8:27'], ['Подпись снизу', 'ещё 7 мин'],
    ['Итог · текст', 'надёжно'], ['Пилюля 2 · текст', 'в пути ~29 мин'], ['Пилюля 3 · текст', 'нужен зонт'], ['Метка', 'Лучше всего']]);
  const kBest = set.addComponentProperty('Лучше всего', 'BOOLEAN', false);
  const kP2 = set.addComponentProperty('Показать пилюлю 2', 'BOOLEAN', true);
  const kP3 = set.addComponentProperty('Показать пилюлю 3', 'BOOLEAN', false);
  const kIco = set.addComponentProperty('Иконка · вид', 'INSTANCE_SWAP', IC['Метро'].id);
  for (const c of set.children) {
    const b = c.findOne(n => n.name === 'Лучше всего'); if (b) b.componentPropertyReferences = { visible: kBest };
    const a = c.findOne(n => n.name === 'Пилюля 2'); if (a) a.componentPropertyReferences = { visible: kP2 };
    const d = c.findOne(n => n.name === 'Пилюля 3'); if (d) d.componentPropertyReferences = { visible: kP3 };
    const ic = c.findOne(n => n.name === 'Иконка' && n.type === 'INSTANCE'); if (ic) ic.componentPropertyReferences = { mainComponent: kIco };
    await fx(c, 'ГИС/Карточка на светлом');
  }
  const bottom = CP.children.filter(n => n !== set).reduce((mx, n) => Math.max(mx, n.y + n.height), 0);
  set.x = 0; set.y = bottom + 48;
  return set;
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
let CARD2;
// o: { n, ic, d, top, main, bottom, v, p2:[cls,text], p3:[cls,text], best, sel }
async function card2(parent, o) {
  const i = inst(CARD2, { 'Итог': o.v, 'Выбрана': o.sel ? 'Да' : 'Нет' },
    { 'Название': o.n, 'Детали': o.d, 'Подпись сверху': o.top, 'Главное': o.main, 'Подпись снизу': o.bottom || '', 'Итог · текст': o.v.toLowerCase(),
      'Пилюля 2 · текст': o.p2 ? o.p2[1] : '', 'Пилюля 3 · текст': o.p3 ? o.p3[1] : '', 'Метка': 'Лучше всего' },
    { 'Лучше всего': !!o.best, 'Показать пилюлю 2': !!o.p2, 'Показать пилюлю 3': !!o.p3 });
  const k = pkey(CARD2, 'Иконка · вид'); if (k) { try { i.setProperties({ [k]: IC[o.ic].id }); } catch (e) { } }
  if (o.p2) await recolor(i.findOne(n => n.name === 'Пилюля 2'), o.p2[0]);
  if (o.p3) await recolor(i.findOne(n => n.name === 'Пилюля 3'), o.p3[0]);
  i.name = 'Вариант: ' + o.n;
  parent.appendChild(i); i.layoutSizingHorizontal = 'FILL';
  return i;
}

// ---------- Переключатели ----------
function seg(parent, labels, act, name) {
  const s = ROW(parent, { name: name || 'Переключатель', pad: 4, r: 12, bg: 'lav', gap: 0 });
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
  const box = AL(s, 'VERTICAL', { name: 'Управление', gap: 12, w: 360, px: 16, x: 0, y });
  const m = seg(box, ['Тороплюсь', 'Гуляю'], 0, 'Режим'); await segText(m, ['Тороплюсь', 'Гуляю'], 0);
  return { box };
}
async function timeChips(parent, mode) {
  const chips = AL(parent, 'HORIZONTAL', { name: 'Время: быстрый выбор', gap: 8, wrap: true }); chips.layoutSizingHorizontal = 'FILL'; chips.primaryAxisSizingMode = 'FIXED';
  const list = mode === 'arrive' ? ['8:30', '9:00', '9:30', '10:00'] : ['Сейчас', '8:30', '8:45', '9:00'];
  const on = mode === 'arrive' ? '9:00' : '8:45';
  for (const l of list) chips.appendChild(await pillC(l === on ? 'Активная' : 'Обычная', l));
  return chips;
}
async function hint(parent, text) {
  const h = ROW(parent, { name: 'Подсказка: дождь', gap: 8, px: 12, py: 12, r: 14, bg: 'white', stroke: 'line', align: 'CENTER' }); h.layoutSizingHorizontal = 'FILL';
  h.appendChild(icoInst('Дождь', 'accent'));
  const t = await TX(h, text, 'cap', 'ink'); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
  await TX(h, 'Модули', 'cap', 'accent', { name: 'Ссылка: модули' });
  return h;
}

// ---------- Данные экранов (из прототипа index.html, 22.11) ----------
const D = {
  metro: { n: 'Метро', ic: 'Метро', d: '5 остановок без пересадок · ≈ 70 ₽' },
  taxi: { n: 'Такси', ic: 'Машина', d: 'подача 3–9 мин · ≈ 650 ₽' },
  carshare: { n: 'Каршеринг', ic: 'Машина', d: 'машина в 360 м · ≈\u00a0300\u2011500\u00a0₽' },   // неразрывные дефис и пробелы: цена не переносится
  walk: { n: 'Пешком', ic: 'Пешком', d: '≈ 10 км · бесплатно' }
};
const C = (k, o) => Object.assign({}, D[k], o);

// ---------- Экраны ----------
async function compareScreen(i, name, title, chipText, cards, extra) {
  const s = phone(name, i);
  const h = await header(s, 'Первомайская ул., 100 → м. Бауманская', title, 'Сейчас 8:20', null, chipText);
  const chip = LAST_TIME_CHIP;
  const c = await controls(s, h.height + 12);
  const list = AL(s, 'VERTICAL', { name: 'Способы', gap: 16, w: 360, px: 16, x: 0, y: c.box.y + c.box.height + 16 });
  list.clipsContent = false;
  if (extra) await extra(list);
  const made = []; for (const o of cards) made.push(await card2(list, o));
  await hint(list, 'Дождь с 8:40 — пешком чуть дольше, это уже в прогнозе');
  await TX(list, 'Время, цены и ориентиры в прототипе примерные. «Самое позднее» — так в 19 поездках из 20.', 'small', 'mute', { fill: true });
  scrollable(s, list);
  return { s, chip, made };
}
async function p1() {
  const r = await compareScreen(0, 'P1 · Как успеть к 9:00', 'Как успеть к', '9:00', [
    C('metro', { top: 'выйди до', main: '8:23', bottom: 'ещё 3 мин', v: 'Надёжно', p2: ['n', 'в пути ~33 мин'], best: true, sel: true }),
    C('taxi', { top: 'вызывай', main: 'сейчас', bottom: 'будешь ~8:54', v: 'Риск из-за пробок', p2: ['n', 'в пробку — опоздаешь на 4 мин'] }),
    C('carshare', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~9:02', v: 'Скорее опоздаешь', p2: ['n', 'обычно опоздание ~2 мин'] }),
    C('walk', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~10:31', v: 'Не успеешь', p2: ['n', 'опоздание ~1 ч 31 мин'] })
  ]);
  return { s: r.s, other: r.chip, metro: r.made[0], taxi: r.made[1] };
}
async function p2() {
  const r = await compareScreen(1, 'P2 · Если выйти в 8:45', 'Если выйти', 'в 8:45', [
    C('metro', { top: 'будешь в', main: '9:14', bottom: 'самое позднее 9:18', v: 'Стабильно', p2: ['r', 'к 9:00 опоздаешь на ~14 мин'], best: true, sel: true }),
    C('taxi', { top: 'будешь в', main: '9:19', bottom: 'самое позднее 9:29', v: 'Зависит от пробок', p2: ['r', 'к 9:00 опоздаешь на ~19 мин'] }),
    C('carshare', { top: 'будешь в', main: '9:27', bottom: 'самое позднее 9:37', v: 'Зависит от пробок', p2: ['r', 'к 9:00 опоздаешь на ~27 мин'] }),
    C('walk', { top: 'будешь в', main: '10:56', bottom: 'самое позднее 11:02', v: 'Стабильно', p2: ['r', 'к 9:00 опоздаешь на ~1 ч 56 мин'] })   // «нужен зонт» убран: не больше двух пилюль
  ]);
  return { s: r.s, other: r.chip };
}
async function p7() {
  let banner = null;
  const r = await compareScreen(6, 'P7 · К 8:30 уже не успеть', 'Как успеть к', '8:30', [
    C('metro', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~8:49', v: 'Не успеешь', p2: ['n', 'опоздание ~19 мин'] }),
    C('taxi', { top: 'вызывай', main: 'сейчас', bottom: 'будешь ~8:54', v: 'Не успеешь', p2: ['n', 'опоздание ~24 мин'] }),
    C('carshare', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~9:02', v: 'Не успеешь', p2: ['n', 'опоздание ~32 мин'] }),
    C('walk', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~10:31', v: 'Не успеешь', p2: ['n', 'опоздание ~2 ч 1 мин'] })
  ], async list => {
    banner = AL(list, 'VERTICAL', { name: 'Поздно: действия', gap: 8, px: 16, py: 12, r: 16, bg: 'pinkL', fill: true });
    await TX(banner, 'К 8:30 уже не успеть', 'bodyM', 'pinkT', { fill: true });
    await TX(banner, 'Быстрее всего — метро, будешь около 8:49', 'cap', 'pinkT', { fill: true });
    const row = AL(banner, 'HORIZONTAL', { name: 'Действия', gap: 8, wrap: true }); row.layoutSizingHorizontal = 'FILL'; row.primaryAxisSizingMode = 'FIXED';
    for (const t of ['Показать к 9:00', 'Самый быстрый', 'Предупредить, что опоздаю']) row.appendChild(await pillC('Кнопка', t));
  });
  return { s: r.s, banner };
}
async function p3() {
  const s = phone('P3 · Когда? (шторка)', 2);
  const h = await header(s, 'Первомайская ул., 100 → м. Бауманская', 'Как успеть к', 'Сейчас 8:20', null, '9:00');
  const dim = figma.createRectangle(); dim.name = 'Затемнение'; dim.resize(360, 800); dim.fills = [pv('ink')]; dim.opacity = 0.35; s.appendChild(dim);
  const sheet = AL(s, 'VERTICAL', { name: 'Шторка: время', gap: 16, w: 360, px: 16, r: 24, bg: 'soft', x: 0, y: 190 });
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
  await TX(box, 'Прогноз покажет, когда выйти. Прошедшее время — это завтра.', 'cap', 'mute', { fill: true });
  const done = await pillC('Тёмная', 'Готово'); box.appendChild(done); done.layoutSizingHorizontal = 'FILL';
  sheet.y = 800 - sheet.height;
  return { s, done };
}
async function route(i, name, small, title, sub, pills, steps, cta) {
  const s = phone(name, i);
  const h = await header(s, '← ' + small, title, sub);
  const pr = AL(s, 'HORIZONTAL', { name: 'Итог', gap: 8, x: 16, y: h.height + 12 });
  for (const [cls, text] of pills) { const p = AL(pr, 'HORIZONTAL', { name: 'Пилюля', px: 12, py: 4, r: 12, bg: PILLC[cls][0] }); await TX(p, text, 'small', PILLC[cls][1]); }
  let y = pr.y + pr.height + 30;
  const step = 92;
  for (let k = 0; k < steps.length; k++) {
    const st = steps[k];
    if (k < steps.length - 1) L(s, [[28, y + 8], [28, y + step - 6]], st.c, 3, { dash: st.dash ? [2, 6] : null, name: 'Линия шага' });
    EL(s, 28, y, 6, 6, { fill: 'white', stroke: st.c === 'dash' ? 'mute' : st.c, sw: 2.5, name: 'Точка шага' });
    await TX(s, st.t, 'bodyM', 'ink', { x: 48, y: y - 10, name: 'Шаг' });
    await TX(s, st.m, 'small', 'mute', { x: 48, y: y + 10, name: 'Время шага' });
    if (st.l) {   // ориентир — белая плашка с тонкой рамкой; предупреждение (st.w) — оранжевая
      const chip = AL(s, 'HORIZONTAL', { name: st.w ? 'Предупреждение' : 'Ориентир', gap: 8, px: 12, py: 8, r: 10, bg: st.w ? 'orange' : 'white', stroke: st.w ? null : 'line', align: 'CENTER', x: 48, y: y + 30 });
      chip.appendChild(icoInst(st.ic, st.w ? 'orangeT' : 'accent'));
      const tx = await TX(chip, st.l, 'small', st.w ? 'orangeT' : 'lavT');
      if (chip.width > 296) { chip.primaryAxisSizingMode = 'FIXED'; chip.resize(296, chip.height); tx.layoutGrow = 1; tx.textAutoResize = 'HEIGHT'; }
    }
    y += step;
  }
  const go = await pillC('Тёмная', cta); s.appendChild(go); go.resize(328, 44); go.x = 16; go.y = 800 - 24 - 44;
  return { s, go, back: h };
}
function card(parent, name, o) {
  const c = AL(parent, 'VERTICAL', Object.assign({ name, gap: 12, px: 16, py: 16, r: 16, bg: 'white', stroke: 'line', fill: true }, o || {}));
  return c;
}
async function kv(parent, a, b, o) {
  o = o || {};
  const r = ROW(parent, { name: a, gap: 8, align: 'CENTER', justify: 'SPACE_BETWEEN' }); r.layoutSizingHorizontal = 'FILL';
  const ta = await TX(r, a, o.aStyle || 'cap', 'mute'); ta.layoutGrow = 1; ta.textAutoResize = 'HEIGHT';
  await TX(r, b, o.bStyle || 'bodyM', o.bColor || 'ink');
  return r;
}
// Горизонтальная карточка фиксированной ширины 328: текст посередине растягивается, ничего не обрезается
function hcard(parent, name, o) {
  const c = card(parent, name, o);
  c.layoutMode = 'HORIZONTAL'; c.itemSpacing = 12; c.counterAxisAlignItems = 'CENTER';
  c.primaryAxisSizingMode = 'FIXED'; c.counterAxisSizingMode = 'AUTO'; c.resize(328, c.height || 10);
  c.layoutSizingHorizontal = 'FILL';
  return c;
}
function textCol(parent) { const t = AL(parent, 'VERTICAL', { name: 'Текст', gap: 2 }); t.layoutGrow = 1; t.clipsContent = false; return t; }
// Переключатель вкл/выкл — простые фигуры
// Новые иконки (проверка 5, художник): 20×20, линия 1.75, скруглённые концы
function gearPath(){ const pts = []; for(let i=0;i<6;i++){ const a = i*Math.PI/3 - Math.PI/2; const c = Math.cos(a), s = Math.sin(a);
  pts.push(`M ${(10+5.6*c).toFixed(2)} ${(10+5.6*s).toFixed(2)} L ${(10+7.6*c).toFixed(2)} ${(10+7.6*s).toFixed(2)}`); } return pts; }
Object.assign(ICONS, {
  'Такси': ['M 3 13 L 3 10 L 5 6 C 5.3 5.4 5.9 5 6.6 5 L 13.4 5 C 14.1 5 14.7 5.4 15 6 L 17 10 L 17 13 Z', 'M 3 10 L 17 10', circ(6.5, 14.5, 1.5), circ(13.5, 14.5, 1.5), 'M 8 5 L 8 2.8 L 12 2.8 L 12 5'],
  'Каршеринг': ['M 3 14 L 3 11 L 5 7.5 C 5.3 6.9 5.9 6.5 6.6 6.5 L 13.4 6.5 C 14.1 6.5 14.7 6.9 15 7.5 L 17 11 L 17 14 Z', 'M 3 11 L 17 11', circ(6.5, 15.5, 1.3), circ(13.5, 15.5, 1.3), 'M 7.2 3.6 C 8.9 2.2 11.1 2.2 12.8 3.6'],
  'Лист': ['M 4 16 C 4 8.5 8.5 4 16 4 C 16 11.5 11.5 16 4 16 Z', 'M 4 16 L 11.5 8.5'],
  'Толпа': [circ(7, 6.2, 2.3), 'M 2.5 16 C 2.5 12.5 4.5 10.8 7 10.8 C 9.5 10.8 11.5 12.5 11.5 16', circ(13.6, 6.6, 2), 'M 12.6 11 C 15.4 10.7 17.5 12.3 17.5 15.5'],
  'Вагон': [rrect(5, 2.5, 10, 12, 2.5), 'M 5 9 L 15 9', 'M 8 12 L 8.1 12', 'M 11.9 12 L 12 12', 'M 7.5 14.5 L 5.5 17.5', 'M 12.5 14.5 L 14.5 17.5'],
  'Пин': ['M 10 18 C 10 18 4.5 12.2 4.5 8 C 4.5 5 7 2.5 10 2.5 C 13 2.5 15.5 5 15.5 8 C 15.5 12.2 10 18 10 18 Z', circ(10, 8, 2)],
  'Звезда': ['M 10 2.8 L 12.2 7.4 L 17.2 8 L 13.5 11.4 L 14.5 16.4 L 10 13.9 L 5.5 16.4 L 6.5 11.4 L 2.8 8 L 7.8 7.4 Z'],
  'Шестерёнка': [circ(10, 10, 5.6), circ(10, 10, 2.2)].concat(gearPath()),
  'Песочные часы': ['M 5.5 3 L 14.5 3', 'M 5.5 17 L 14.5 17', 'M 7 3 C 7 7 13 7 13 10 C 13 13 7 13 7 17', 'M 13 3 C 13 7 7 7 7 10 C 7 13 13 13 13 17'],
  'Эскалатор': ['M 2.5 16 L 6.5 16 L 13.5 5 L 17.5 5', 'M 8.5 7 L 8.5 7.1', 'M 6.5 10.5 L 11 10.5'],
  'Готово': [circ(10, 10, 7), 'M 6.8 10.2 L 9 12.4 L 13.4 7.8'],
  'История': ['M 4.2 6.8 C 5.4 4.5 7.6 3 10 3 C 13.9 3 17 6.1 17 10 C 17 13.9 13.9 17 10 17 C 6.6 17 3.8 14.6 3.2 11.4', 'M 3.2 3.6 L 4.2 6.8 L 7.4 6', 'M 10 6.5 L 10 10 L 12.5 11.5'],
  'Флаг': ['M 5 18 L 5 3', 'M 5 3.5 L 15 3.5 L 12.5 7 L 15 10.5 L 5 10.5']
});
const COLW = 440, ROWH = 1000;
function phoneAt(name, col, row) {
  const s = figma.createFrame();
  s.name = name; s.resize(360, 800); s.cornerRadius = 28; s.clipsContent = true; s.fills = [pv('bg')];
  PG.appendChild(s); s.x = col * COLW; s.y = row * ROWH;
  return s;
}
// Карта-фон: дороги, река, «ты здесь»; опционально — точка назначения и линия маршрута
const ME = [262, 250], DST = [92, 470];
function miniMap(s, o) {
  o = o || {};
  const m = figma.createFrame(); m.name = 'Карта'; m.resize(360, 800); m.fills = []; m.clipsContent = true; s.appendChild(m); m.x = 0; m.y = 0;
  for (const p of [[[0, 120], [360, 90]], [[0, 330], [360, 300]], [[0, 560], [360, 600]], [[60, 0], [40, 800]], [[200, 0], [230, 800]], [[320, 0], [300, 800]], [[0, 700], [360, 420]]])
    L(m, p, 'lime', 3, { op: 0.28, name: 'Улица' });
  L(m, [[0, 420], [140, 400], [250, 440], [360, 380]], 'river', 18, { op: 0.45, name: 'Река' });
  if (o.route) {
    L(m, [ME, [230, 300], [200, 360], [140, 420], DST], 'white', 9, { name: 'Маршрут: подложка' });
    L(m, [ME, [230, 300], [200, 360], [140, 420], DST], 'accent', 5, { name: 'Маршрут' });
  }
  if (o.dest) {
    EL(m, DST[0], DST[1], 14, 14, { fill: 'white', name: 'Место: подложка' });
    EL(m, DST[0], DST[1], 9, 9, { fill: 'pink', name: 'Место' });
  }
  EL(m, ME[0], ME[1], 16, 16, { fill: 'white', op: 0.35, name: 'Ты здесь: ореол' });
  EL(m, ME[0], ME[1], 8, 8, { fill: 'accent', stroke: 'white', sw: 3, name: 'Ты здесь' });
  return m;
}
async function status(s, color) { await TX(s, '8:20', 'small', color || 'white', { x: 20, y: 10, name: 'Статус-бар' }); }
// Плавающее поле поиска
async function searchField(s, y, text, typed) {
  // ROW — фиксированная ширина 328 (AL с w ужимался по содержимому и обрезал поле)
  const row = ROW(s, { name: 'Поиск', gap: 8, w: 328, x: 16, y, align: 'CENTER' }); row.clipsContent = false;
  const f = AL(row, 'HORIZONTAL', { name: 'Поле «Куда?»', gap: 12, px: 16, py: 12, r: 22, bg: 'white', align: 'CENTER' }); f.layoutGrow = 1;
  await fx(f, 'ГИС/Уровень 1');
  f.appendChild(icoInst('Поиск', typed ? 'ink' : 'mute'));
  const t = await TX(f, text, 'body', typed ? 'ink' : 'mute'); t.layoutGrow = 1; t.textAutoResize = 'HEIGHT';
  f.clipsContent = false;
  const b = AL(row, 'HORIZONTAL', { name: 'Модули', pad: 12, r: 22, bg: 'white', align: 'CENTER' }); b.appendChild(icoInst('Шестерёнка', 'ink')); b.clipsContent = false;
  await fx(b, 'ГИС/Уровень 1');
  return { row, field: f };
}
// Чип «Погулять рядом» — белый, над картой виден
async function walkChip(s, sf) {
  const c = AL(s, 'HORIZONTAL', { name: 'Чип: погулять рядом', gap: 8, px: 16, py: 8, r: 18, bg: 'white', align: 'CENTER', x: 16, y: sf.row.y + sf.row.height + 12 });
  c.clipsContent = false; await fx(c, 'ГИС/Уровень 1');
  c.appendChild(icoInst('Пешком', 'accent')); await TX(c, 'Погулять рядом', 'cap', 'ink');
  return c;
}
// Шторка снизу: от y до низа экрана
function sheetAt(s, y, name) {
  const sh = AL(s, 'VERTICAL', { name: name || 'Шторка', gap: 12, w: 360, px: 16, bg: 'soft', x: 0, y });
  sh.paddingTop = 12; sh.paddingBottom = 24; sh.topLeftRadius = 24; sh.topRightRadius = 24;
  sh.primaryAxisSizingMode = 'FIXED'; sh.resize(360, 800 - y); sh.clipsContent = true;
  const hw = AL(sh, 'HORIZONTAL', { name: 'Ручка', justify: 'CENTER', fill: true });
  const h = figma.createRectangle(); h.name = 'Ручка'; h.resize(40, 4); h.cornerRadius = 2; h.fills = [pv('dash')]; hw.appendChild(h);
  return sh;
}
async function sectionTitle(parent, t) { return TX(parent, t, 'cap', 'mute', { fill: true, name: 'Раздел: ' + t }); }
async function rowItem(parent, ic, title, sub, right, rightColor) {
  const c = hcard(parent, title); c.paddingTop = c.paddingBottom = 12;
  const ib = AL(c, 'HORIZONTAL', { name: 'Иконка', pad: 8, r: 12, bg: 'lav' }); ib.appendChild(icoInst(ic, 'accent'));
  const tx = textCol(c);
  await TX(tx, title, 'bodyM', 'ink', { fill: true }); if (sub) await TX(tx, sub, 'small', 'mute', { fill: true });
  if (right) { const r = AL(c, 'VERTICAL', { name: 'Справа', gap: 0, align: 'MAX' });
    for (const [i, line] of right.split('\n').entries()) await TX(r, line, i === 1 ? 'bodyM' : 'small', i === 1 ? (rightColor || 'accent') : 'mute'); }
  return c;
}
// Строка «Откуда / время»
async function tripBar(parent, timeText, timeOn) {
  const r = ROW(parent, { name: 'Откуда и когда', gap: 8, align: 'CENTER' }); r.layoutSizingHorizontal = 'FILL';
  // высота 40 и скругление 20 — как у остальных кнопок (пилюль)
  const h40 = f => { f.counterAxisSizingMode = 'FIXED'; f.resize(f.width || 10, 40); f.counterAxisAlignItems = 'CENTER'; };
  const from = AL(r, 'HORIZONTAL', { name: 'Откуда', gap: 8, px: 4, align: 'CENTER' }); from.layoutGrow = 1; h40(from);   // как в прототипе: текст, не поле
  EL(from, 0, 0, 5, 5, { fill: 'accent', name: 'Точка' });
  const ft = await TX(from, 'Отсюда', 'cap', 'ink'); ft.layoutGrow = 1;
  const t = AL(r, 'HORIZONTAL', { name: 'Время', gap: 8, px: 16, r: 20, bg: timeOn ? 'accent' : 'lav', align: 'CENTER' }); h40(t);
  t.appendChild(icoInst('Часы', timeOn ? 'white' : 'accent'));
  await TX(t, timeText + ' ▾', 'cap', timeOn ? 'white' : 'lavT');
  return { r, time: t };
}
// Короткая строка способов на карточке места
async function quickModes(parent) {
  const r = AL(parent, 'HORIZONTAL', { name: 'Как добраться: коротко', gap: 8, wrap: true }); r.layoutSizingHorizontal = 'FILL'; r.primaryAxisSizingMode = 'FIXED';
  for (const [ic, t] of [['Метро', '33 мин'], ['Машина', 'такси 34 мин'], ['Пешком', '2 ч 11 мин']]) {
    const c = AL(r, 'HORIZONTAL', { name: t, gap: 8, px: 12, py: 8, r: 12, bg: 'white', stroke: 'line', align: 'CENTER' });
    c.appendChild(icoInst(ic, 'accent')); await TX(c, t, 'cap', 'ink');
  }
  return r;
}
async function buttons(parent, main, second, mainIc) {
  const r = ROW(parent, { name: 'Кнопки', gap: 8 }); r.layoutSizingHorizontal = 'FILL';
  const a = await pillC('Тёмная', main); r.appendChild(a); a.layoutGrow = 1;
  let b = null; if (second) { b = await pillC('Кнопка', second); r.appendChild(b); }
  return { a, b };
}
// Карточки способов — компонент «Карточка варианта · v2»
// проверка 5: иконки как в прототипе — такси и каршеринг свои, модули — шестерёнка
D.taxi.ic = 'Такси'; D.carshare.ic = 'Каршеринг';
const DEPART = [
  C('metro', { top: 'будешь в', main: '8:53', bottom: 'самое позднее 8:57', v: 'Стабильно', best: true }),
  C('taxi', { top: 'будешь в', main: '8:54', bottom: 'самое позднее 9:04', v: 'Зависит от пробок' }),
  C('carshare', { top: 'будешь в', main: '9:02', bottom: 'самое позднее 9:12', v: 'Зависит от пробок' }),
  C('walk', { top: 'будешь в', main: '10:31', bottom: 'самое позднее 10:37', v: 'Стабильно' })
];
const ARRIVE = [
  C('metro', { top: 'выйди до', main: '8:23', bottom: 'ещё 3 мин', v: 'Надёжно', p2: ['n', 'в пути ~33 мин'], best: true }),
  C('taxi', { top: 'вызывай', main: 'сейчас', bottom: 'будешь ~8:54', v: 'Риск из-за пробок', p2: ['n', 'в пробку — опоздаешь на 4 мин'] }),
  C('carshare', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~9:02', v: 'Скорее опоздаешь' }),
  C('walk', { top: 'выходи', main: 'сейчас', bottom: 'будешь ~10:31', v: 'Не успеешь' })
];
async function modeCards(parent, list) { const made = []; for (const o of list) made.push(await card2(parent, o)); return made; }


// ================= Калибровка «Мой темп» v2 (24.11) — как модуль в прототипе =================
// Вопрос живёт на «Ты на месте»: после первой поездки — «Как ты обычно ходишь?», дальше — «Что-то задержало?».
// Настройки — экран модуля из «Модулей». Маршрут — в шторке над картой, как в прототипе.
async function doneHead(sh, time, sub) {
  const art = AL(sh, 'HORIZONTAL', { name: 'Флажок', gap: 12, align: 'CENTER' });
  const f = AL(art, 'HORIZONTAL', { name: 'Круг', pad: 16, r: 28, bg: 'limeP', align: 'CENTER', justify: 'CENTER' }); f.appendChild(icoInst('Флаг', 'limeT'));
  for (const c of ['lav', 'orange', 'bg']) EL(art, 0, 0, 4, 4, { fill: c, name: 'Конфетти' });
  await TX(sh, 'Ты на месте в ' + time, 'title', 'ink', { fill: true });
  await TX(sh, sub, 'cap', 'mute', { fill: true });
}
async function choiceRow(parent, labels, sel) {
  const w = AL(parent, 'HORIZONTAL', { name: 'Варианты', gap: 8, wrap: true }); w.layoutSizingHorizontal = 'FILL'; w.primaryAxisSizingMode = 'FIXED';
  const made = [];
  for (const l of labels) {
    const on = sel.includes(l);
    const c = AL(w, 'HORIZONTAL', { name: l, px: 16, r: 22, bg: on ? 'limeP' : 'white', stroke: on ? null : 'line', align: 'CENTER' });
    c.counterAxisSizingMode = 'FIXED'; c.resize(10, 44); c.primaryAxisSizingMode = 'AUTO';
    await TX(c, l, on ? 'bodyM' : 'body', on ? 'limeT' : 'ink'); made.push(c);
  }
  return made;
}

// ================= Состояния v3 (ревью 6, 25.11) =================
// Обновляет иконки в «ГИС · Компоненты» (экземпляры по всему файлу обновятся сами) и собирает лист состояний.
PAL.dis = ['Состояния/Неактивный фон', '#E4E1F3']; PAL.disT = ['Состояния/Неактивный текст', '#9C97C4'];
PAL.closedT = ['Состояния/Закрыто текст', '#8A86A6'];
const NEW_ICONS = {
  'Такси': ICONS['Машина'].concat(['M 7.5 5 L 7.5 2.5 L 12.5 2.5 L 12.5 5', 'M 10 2.5 L 10 5', 'M 7.5 3.75 L 12.5 3.75']),
  'Каршеринг': [circ(6.5, 10, 3.5), 'M 10 10 L 17.5 10', 'M 14.5 10 L 14.5 13', 'M 17 10 L 17 12.5'],
  'Светофор': ['M 8 2 L 12 2 C 13.1 2 14 2.9 14 4 L 14 16 C 14 17.1 13.1 18 12 18 L 8 18 C 6.9 18 6 17.1 6 16 L 6 4 C 6 2.9 6.9 2 8 2 Z', circ(10, 5.6, 1.4), circ(10, 10, 1.4), circ(10, 14.4, 1.4)],
  'Эскалатор': ['M 2.5 17 L 6 17 L 6 14 L 9.5 14 L 9.5 11 L 13 11 L 13 8 L 17.5 8', 'M 2.5 13 L 11 4.5 L 17.5 4.5'],
  'Шестерёнка': ['M 3 5 L 5.2 5', 'M 8.8 5 L 17 5', circ(7, 5, 1.8), 'M 3 10 L 11.2 10', 'M 14.8 10 L 17 10', circ(13, 10, 1.8), 'M 3 15 L 7.2 15', 'M 10.8 15 L 17 15', circ(9, 15, 1.8)],
  'Шаги': ["M 6.3 6.6 C 7.349 6.6 8.2 7.943 8.2 9.6 C 8.2 11.257 7.349 12.6 6.3 12.6 C 5.251 12.6 4.4 11.257 4.4 9.6 C 4.4 7.943 5.251 6.6 6.3 6.6 Z", "M 6.3 15.2 C 7.018 15.2 7.6 15.648 7.6 16.2 C 7.6 16.752 7.018 17.2 6.3 17.2 C 5.582 17.2 5.0 16.752 5.0 16.2 C 5.0 15.648 5.582 15.2 6.3 15.2 Z", "M 13.7 1.0999999999999996 C 14.749 1.0999999999999996 15.6 2.443 15.6 4.1 C 15.6 5.757 14.749 7.1 13.7 7.1 C 12.651 7.1 11.799999999999999 5.757 11.799999999999999 4.1 C 11.799999999999999 2.443 12.651 1.0999999999999996 13.7 1.0999999999999996 Z", "M 13.7 9.7 C 14.418 9.7 15.0 10.148 15.0 10.7 C 15.0 11.252 14.418 11.7 13.7 11.7 C 12.982 11.7 12.399999999999999 11.252 12.399999999999999 10.7 C 12.399999999999999 10.148 12.982 9.7 13.7 9.7 Z"],
  'Песочные часы': ['M 5.5 3 L 14.5 3', 'M 5.5 17 L 14.5 17', 'M 6.5 3 L 6.5 5.5 L 10 10 L 6.5 14.5 L 6.5 17', 'M 13.5 3 L 13.5 5.5 L 10 10 L 13.5 14.5 L 13.5 17', 'M 8.3 15.6 L 11.7 15.6']
};
Object.assign(ICONS, NEW_ICONS);
// Существующий компонент иконки: заменить контур (экземпляры подхватят)
function updateIcon(name) {
  const c = CP.findOne(n => n.type === 'COMPONENT' && n.name === 'Иконка / ' + name); if (!c) return false;
  const v = c.findOne(n => n.type === 'VECTOR'); if (!v) return false;
  const { out, mx, my } = shiftPaths(ICONS[name]);
  v.vectorPaths = out.map(d => ({ windingRule: 'NONE', data: d })); v.x = mx; v.y = my;
  return true;
}
function tog(parent, on) {
  const t = figma.createFrame(); t.name = 'Переключатель: ' + (on ? 'вкл' : 'выкл'); t.resize(44, 26); t.clipsContent = false; t.cornerRadius = 13; t.fills = [pv(on ? 'accent' : 'line')];
  EL(t, on ? 31 : 13, 13, 10, 10, { fill: 'white', name: 'Ручка' });
  parent.appendChild(t); t.layoutSizingHorizontal = 'FIXED'; t.layoutSizingVertical = 'FIXED'; return t;
}
// Чип: обычный / выбранный (тёмный с галочкой) / неактивный
async function chipS(parent, label, kind) {
  const bg = kind === 'sel' ? 'ink' : kind === 'dis' ? 'dis' : 'white';
  const c = AL(parent, 'HORIZONTAL', { name: 'Чип: ' + label + ' · ' + ({ sel: 'выбран', dis: 'неактивен' }[kind] || 'обычный'), gap: 8, px: kind === 'sel' ? 12 : 16, r: 20, bg, stroke: kind ? null : 'line', align: 'CENTER' });
  c.counterAxisSizingMode = 'FIXED'; c.resize(10, 40); c.primaryAxisSizingMode = 'AUTO';
  if (kind === 'sel') c.appendChild(icoInst('Галочка', 'white'));
  await TX(c, label, kind === 'sel' ? 'bodyM' : 'body', kind === 'sel' ? 'white' : kind === 'dis' ? 'disT' : 'ink');
  return c;
}
async function btnS(parent, label, kind) {
  const c = AL(parent, 'HORIZONTAL', { name: 'Кнопка: ' + label, px: 20, r: 22, bg: kind === 'dis' ? 'dis' : 'ink', align: 'CENTER', justify: 'CENTER' });
  c.counterAxisSizingMode = 'FIXED'; c.resize(10, 44); c.primaryAxisSizingMode = 'AUTO';
  await TX(c, label, 'bodyM', kind === 'dis' ? 'disT' : 'white'); return c;
}
async function pillS(parent, cls, t) { const p = AL(parent, 'HORIZONTAL', { name: 'Пилюля: ' + t, px: 12, py: 4, r: 12, bg: PILLC[cls][0] }); await TX(p, t, 'small', PILLC[cls][1]); return p; }
// «Отсюда» — белая пилюля-подпись (не кнопка), рядом — время
async function tripBarV3(parent, timeText, timeOn) {
  const r = ROW(parent, { name: 'Откуда и когда', gap: 8, align: 'CENTER' }); r.layoutSizingHorizontal = 'FILL';
  const h40 = f => { f.counterAxisSizingMode = 'FIXED'; f.resize(f.width || 10, 40); f.counterAxisAlignItems = 'CENTER'; };
  const from = AL(r, 'HORIZONTAL', { name: 'Откуда (подпись)', gap: 8, px: 16, r: 20, bg: 'white', stroke: 'line', align: 'CENTER' }); from.layoutGrow = 1; h40(from);
  EL(from, 0, 0, 5, 5, { fill: 'accent', name: 'Точка' });
  const ft = await TX(from, 'Отсюда', 'cap', 'ink'); ft.layoutGrow = 1;
  const t = AL(r, 'HORIZONTAL', { name: 'Время', gap: 8, px: 16, r: 20, bg: timeOn ? 'accent' : 'lav', align: 'CENTER' }); h40(t);
  t.appendChild(icoInst('Часы', timeOn ? 'white' : 'accent'));
  await TX(t, timeText + ' ▾', 'cap', timeOn ? 'white' : 'lavT');
  return r;
}
async function sheetHead(sh, title) {
  const head = ROW(sh, { name: 'Назад', gap: 12, align: 'CENTER' }); head.layoutSizingHorizontal = 'FILL';
  const back = AL(head, 'HORIZONTAL', { name: 'Назад', pad: 12, r: 14, bg: 'white', align: 'CENTER' }); back.appendChild(icoInst('Назад', 'ink'));
  await TX(head, title, 'title', 'ink'); return back;
}
// Карточка модуля с переключателем
async function modRow(parent, ic, title, desc, on) {
  const c = hcard(parent, title); c.paddingTop = c.paddingBottom = 12;
  const ib = AL(c, 'HORIZONTAL', { name: 'Иконка', pad: 8, r: 12, bg: 'lav' }); ib.appendChild(icoInst(ic, 'accent'));
  const tx = textCol(c); await TX(tx, title, 'bodyM', 'ink', { fill: true }); await TX(tx, desc, 'small', 'mute', { fill: true });
  tog(c, on); return c;
}

// Карточка способа: строка (иконка, название, справа время) и пилюли итога внутри карточки
async function modeCardV3(parent, ic, n, d, right, pills) {
  const c = card(parent, 'Вариант: ' + n);
  const top = ROW(c, { name: 'Строка', gap: 12, align: 'CENTER' }); top.layoutSizingHorizontal = 'FILL';
  const ib = AL(top, 'HORIZONTAL', { name: 'Иконка', pad: 8, r: 12, bg: 'lav' }); ib.appendChild(icoInst(ic, 'accent'));
  const tx = textCol(top); await TX(tx, n, 'bodyM', 'ink', { fill: true }); await TX(tx, d, 'small', 'mute', { fill: true });
  const r = AL(top, 'VERTICAL', { name: 'Справа', align: 'MAX' });
  for (const [i, line] of right.split('\n').entries()) await TX(r, line, i === 1 ? 'big' : 'small', i === 1 ? 'ink' : 'mute');
  const pr = AL(c, 'HORIZONTAL', { name: 'Итог', gap: 8 }); for (const [cls, t] of pills) await pillS(pr, cls, t);
  return c;
}
// S1 · Модули: выключаю «Пробки» — сначала предупреждение
async function s1() {
  const s = phoneAt('S1 · Модули: выключить «Пробки»', 0, 0); miniMap(s); await status(s);
  const sh = sheetAt(s, 96, 'Шторка: модули');
  await sheetHead(sh, 'Модули');
  await sectionTitle(sh, 'Способы передвижения');
  await modRow(sh, 'Такси', 'Такси', 'Подача и поездка с учётом пробок', true);
  await modRow(sh, 'Каршеринг', 'Каршеринг', 'Ближайшая машина, поездка с учётом пробок', true);
  await sectionTitle(sh, 'Данные');
  await modRow(sh, 'Светофор', 'Пробки', 'Как загружены дороги в разное время', true);
  const o = card(sh, 'Предупреждение: зависимые модули', { bg: 'white' });
  await TX(o, 'Без «Пробки» не будут работать «Такси» и «Каршеринг»', 'bodyM', 'ink', { fill: true });
  const r = ROW(o, { name: 'Кнопки', gap: 8 }); await chipS(r, 'Выключить', 'sel_plain'); await chipS(r, 'Отмена');
  const first = r.children[0]; first.fills = [pv('ink')]; first.strokes = []; const ft = first.findOne(n => n.type === 'TEXT'); ft.fills = [pv('white')];
  return s;
}
// S2 · Способы без «Пробок»: честная строка и «Включить»
async function s2() {
  const s = phoneAt('S2 · Способы: такси ждут «Пробки»', 1, 0); miniMap(s, { dest: true }); await status(s);
  const sh = sheetAt(s, 160, 'Шторка: способы');
  await sheetHead(sh, 'м. Бауманская');
  await tripBarV3(sh, 'Выехать сейчас', false);
  await modeCardV3(sh, 'Метро', 'Метро', '5 остановок · ≈\u00a070\u00a0₽', 'будешь в\n8:53', [['g', 'надёжно']]);
  await modeCardV3(sh, 'Пешком', 'Пешком', '≈\u00a010\u00a0км · бесплатно', 'будешь в\n10:31', [['g', 'надёжно'], ['n', 'нужен зонт']]);
  const h = hcard(sh, 'Подсказка: способы ждут модуль данных'); h.paddingTop = h.paddingBottom = 12;
  h.appendChild(icoInst('Светофор', 'accent'));
  const tx = textCol(h); await TX(tx, 'Такси и Каршеринг — не работают без «Пробки»', 'cap', 'ink', { fill: true });
  await TX(h, 'Включить', 'bodyM', 'accent');
  return s;
}
// S3 · Ночь 0:50: метро закроется раньше, чем дойдёшь — карточка приглушена, не нажимается
async function s3() {
  const s = phoneAt('S3 · 0:50: метро закроется раньше', 2, 0); miniMap(s, { dest: true }); await status(s);
  const sh = sheetAt(s, 160, 'Шторка: способы ночью');
  await sheetHead(sh, 'м. Бауманская');
  await tripBarV3(sh, 'Выехать в 0:50 завтра', true);
  await modeCardV3(sh, 'Такси', 'Такси', 'подача 3–9\u00a0мин · ≈\u00a0650\u00a0₽', 'будешь в\n1:11 завтра', [['g', 'надёжно']]);
  await modeCardV3(sh, 'Пешком', 'Пешком', '≈\u00a010\u00a0км · бесплатно', 'будешь в\n2:54 завтра', [['g', 'надёжно']]);
  const c = card(sh, 'Вариант закрыт: Метро', { bg: 'soft' }); c.strokes = [];
  const top = ROW(c, { name: 'Строка', gap: 12, align: 'CENTER' }); top.layoutSizingHorizontal = 'FILL'; top.opacity = 0.55;
  const ib = AL(top, 'HORIZONTAL', { name: 'Иконка', pad: 8, r: 12, bg: 'lav' }); ib.appendChild(icoInst('Метро', 'accent'));
  const tx = textCol(top); await TX(tx, 'Метро', 'bodyM', 'ink', { fill: true }); await TX(tx, '5 остановок без пересадок', 'small', 'mute', { fill: true });
  const rt = AL(top, 'VERTICAL', { name: 'Справа', align: 'MAX' }); await TX(rt, 'вход', 'small', 'mute'); await TX(rt, 'до 1:00', 'big', 'closedT'); await TX(rt, 'не успеть', 'small', 'mute');
  const pr = AL(c, 'HORIZONTAL', { name: 'Итог', gap: 8 }); pr.opacity = 0.55; await pillS(pr, 'n', 'закроется раньше');
  const note = AL(PG, 'VERTICAL', { name: 'Пояснение к S3', w: 360, x: s.x, y: s.y + 816 });
  await TX(note, 'Закрытый способ — внизу списка, приглушён (.55), «закрыто» — 600 #8A86A6. Не открывается.', 'small', 'mute', { fill: true });
  return s;
}
// S4 · Сохранить: выбранный чип тёмный с галочкой; кнопка неактивна, пока нет названия
async function s4(selected) {
  const s = phoneAt(selected ? 'S4b · Сохранить: выбрано «Работа»' : 'S4a · Сохранить: название не выбрано', selected ? 4 : 3, 0); miniMap(s, { dest: true }); await status(s);
  const sh = sheetAt(s, 300, 'Шторка: сохранить');
  await sheetHead(sh, 'Сохранить маршрут');
  await TX(sh, 'Отсюда → м. Бауманская', 'cap', 'mute', { fill: true });
  await sectionTitle(sh, 'Как назвать');
  const w = AL(sh, 'HORIZONTAL', { name: 'Названия', gap: 8, wrap: true, fill: true }); w.primaryAxisSizingMode = 'FIXED';
  for (const n of ['Работа', 'Учёба', 'Спорт', 'Своё…']) await chipS(w, n, selected && n === 'Работа' ? 'sel' : null);
  const c = card(sh, 'Что сохраним'); await kv(c, 'Время', 'без времени'); await kv(c, 'Способ', 'Метро');
  const b = await btnS(sh, selected ? 'Сохранить' : 'Выбери название', selected ? null : 'dis'); b.layoutSizingHorizontal = 'FILL';
  return s;
}
// S5 · Маршрут: итог и «по твоему темпу» в одной строке; диапазон шага не противоречит «~N мин»
async function s5() {
  const s = phoneAt('S5 · Маршрут: по твоему темпу', 5, 0); miniMap(s, { dest: true, route: true }); await status(s);
  const sh = sheetAt(s, 300, 'Шторка: маршрут');
  const head = ROW(sh, { name: 'Назад', gap: 8, align: 'CENTER' }); head.layoutSizingHorizontal = 'FILL';
  const back = AL(head, 'HORIZONTAL', { name: 'Назад', pad: 12, r: 14, bg: 'white', align: 'CENTER' }); back.appendChild(icoInst('Назад', 'ink'));
  await TX(head, 'Маршрут с ориентирами', 'cap', 'mute');
  await TX(sh, 'Выйдешь сейчас — будешь в 10:51', 'title', 'ink', { fill: true });
  await TX(sh, 'Пешком · бесплатно · самое позднее 10:57', 'cap', 'mute', { fill: true });
  const pr = AL(sh, 'HORIZONTAL', { name: 'Итог', gap: 8, wrap: true, fill: true }); pr.primaryAxisSizingMode = 'FIXED';
  await pillS(pr, 'g', 'надёжно'); await pillS(pr, 'n', 'по твоему темпу'); await pillS(pr, 'n', 'нужен зонт');
  const row = ROW(sh, { name: 'Шаг', gap: 12 }); row.layoutSizingHorizontal = 'FILL';
  const dot = AL(row, 'HORIZONTAL', { name: 'Точка', pad: 8, r: 15, bg: 'white', align: 'CENTER' }); dot.appendChild(icoInst('Пешком', 'ink'));
  const col = AL(row, 'VERTICAL', { name: 'Текст', gap: 4 }); col.layoutGrow = 1;
  await TX(col, 'Пешком до Бауманской', 'bodyM', 'ink', { fill: true }); await TX(col, '8:20 · ~151 мин (обычно 140–165)', 'small', 'mute', { fill: true });
  const go = await pillC('Тёмная', 'Поехали'); s.appendChild(go); go.resize(328, 44); go.x = 16; go.y = 800 - 24 - 44;
  return s;
}
// Лист: состояния и обновлённые иконки
async function sheetV3(y) {
  const sheet = AL(PG, 'VERTICAL', { name: 'Состояния и иконки v3', gap: 16, pad: 32, r: 24, bg: 'white', x: 0, y, w: 1160 });
  await TX(sheet, 'Состояния (ревью 6)', 'title', 'ink');
  await TX(sheet, 'Выбрано — тёмный (ink) с белой галочкой: лайм оставлен только для «надёжно». Неактивно — #E4E1F3 / текст #9C97C4: не похоже на активное. «Отсюда» — белая пилюля-подпись, не кнопка.', 'cap', 'mute', { fill: true });
  const r1 = AL(sheet, 'HORIZONTAL', { name: 'Чипы', gap: 12, align: 'CENTER' });
  await chipS(r1, 'Учёба'); await chipS(r1, 'Работа', 'sel'); await chipS(r1, 'Отправить', 'dis');
  await btnS(r1, 'Сохранить'); await btnS(r1, 'Выбери название', 'dis');
  const r2 = AL(sheet, 'VERTICAL', { name: 'Откуда и когда', w: 360 }); await tripBarV3(r2, 'Выехать сейчас', false);
  const r3 = AL(sheet, 'HORIZONTAL', { name: 'Пилюли итога', gap: 8 }); for (const [c, t] of [['g', 'надёжно'], ['a', 'есть риск'], ['r', 'не успеешь'], ['n', 'по твоему темпу'], ['n', 'закроется раньше']]) await pillS(r3, c, t);
  await TX(sheet, 'Иконки v3: такси — шашка, каршеринг — ключ, «Пробки» — светофор, эскалатор — ступени и поручень, модули — ползунки, ожидание — песочные часы, «Мой темп» — шаги', 'cap', 'mute', { fill: true });
  const g = AL(sheet, 'HORIZONTAL', { name: 'Иконки v3', gap: 12 });
  for (const n of ['Такси', 'Каршеринг', 'Светофор', 'Эскалатор', 'Шестерёнка', 'Песочные часы', 'Шаги']) {
    const cell = AL(g, 'VERTICAL', { name: n, gap: 8, pad: 12, r: 16, bg: 'soft', align: 'CENTER', w: 120 });
    const box = AL(cell, 'HORIZONTAL', { name: 'Подложка', pad: 12, r: 12, bg: 'lav', align: 'CENTER', justify: 'CENTER' }); box.appendChild(icoInst(n, 'accent'));
    await TX(cell, n === 'Шестерёнка' ? 'Модули' : n === 'Светофор' ? 'Пробки' : n === 'Шаги' ? 'Мой темп' : n, 'small', 'ink');
  }
  return sheet;
}


// ================= Дизайн-система v3 (25.11.2026) =================
// Источник правды — прототип (index.html). Плагин: 1) выравнивает переменные цветов, текстовые стили и тени с прототипом
// (существующие макеты подхватят новые значения сами); 2) заводит переменные размеров (4-px сетка, радиусы, высоты);
// 3) собирает компоненты v3 со всеми состояниями — отступы и радиусы привязаны к переменным; 4) рисует страницу-справочник.
const DS_COLORS = {   // ключ PAL → [имя переменной, hex из прототипа]
  ink: ['Текст/Основной', '#1A1640'], ink2: ['Текст/Вторичный', '#4A4670'], mute: ['Текст/Приглушённый', '#6B6787'],
  accent: ['Текст/Акцент', '#4B4BC8'], violet: ['Акценты/Фиолетовый', '#5555DD'],
  white: ['Поверхности/Белый', '#FFFFFF'], soft: ['Поверхности/Подложка', '#F3F2EE'], line: ['Линии/Обводка', '#E1DED6'],
  limeP: ['Акценты/Лайм', '#D7F26B'], limeT: ['Акценты/Лайм текст', '#2B3A00'],
  orange: ['Трафик/Плотно', '#FFB27A'], orangeT: ['Акценты/Оранжевый текст', '#5A2A00'],
  pinkL: ['Акценты/Розовый', '#F6C1D6'], pinkT: ['Акценты/Розовый текст', '#6B1236'],
  lav: ['Акценты/Лаванда', '#ECEBFB'], lavT: ['Акценты/Лаванда текст', '#4B4BC8'],
  dis: ['Состояния/Неактивный фон', '#E4E1F3'], disT: ['Состояния/Неактивный текст', '#9C97C4'], closedT: ['Состояния/Закрыто текст', '#8A86A6'],
  warnBg: ['Состояния/Напоминание срочно', '#FFE3CF'], togOff: ['Переключатель/Выкл', '#8A86A3'], metro3: ['Метро/Линия 3', '#2E6FE6'],
  bg: ['Карта/Фон', '#6C6CF0']
};
for (const k in DS_COLORS) PAL[k] = DS_COLORS[k];
Object.assign(ICONS, { 'Закрыть': ['M 5.5 5.5 L 14.5 14.5', 'M 14.5 5.5 L 5.5 14.5'] });
const DS_NUM = { 'Отступ/2': 2, 'Отступ/4': 4, 'Отступ/8': 8, 'Отступ/12': 12, 'Отступ/16': 16, 'Отступ/24': 24, 'Отступ/32': 32,
  'Радиус/10': 10, 'Радиус/13': 13, 'Радиус/14': 14, 'Радиус/18': 18, 'Радиус/20': 20, 'Радиус/24': 24, 'Радиус/26': 26,
  'Высота/26 пилюля': 26, 'Высота/40 чип': 40, 'Высота/48 поле': 48, 'Высота/52 кнопка': 52 };
const N = {};
const DS_TEXT = {   // ключ TS → [имя, размер, начертание] — как в прототипе (600 → Semi Bold)
  title: ['ГИС/Заголовок', 20, 'Semi Bold'], big: ['ГИС/Крупный', 18, 'Semi Bold'], btn: ['ГИС/Кнопка', 16, 'Semi Bold'],
  body: ['ГИС/Текст', 14, 'Regular'], bodyM: ['ГИС/Текст акцент', 14, 'Semi Bold'], cap: ['ГИС/Подпись', 13, 'Regular'],
  small: ['ГИС/Мелкий', 12, 'Regular'], pill: ['ГИС/Пилюля', 12, 'Medium'], tiny: ['ГИС/Метка', 11, 'Regular'] };
const SH = (y, b, a) => ({ type: 'DROP_SHADOW', color: { r: 20 / 255, g: 17 / 255, b: 58 / 255, a }, offset: { x: 0, y }, radius: b, spread: 0, visible: true, blendMode: 'NORMAL' });
const DS_FX = { 'ГИС/Карточка на светлом': [SH(1, 2, .06), SH(4, 14, .07)], 'ГИС/Уровень 1': [SH(4, 10, .18), SH(16, 36, .22)], 'ГИС/Уровень 3': [SH(-4, 12, .12), SH(-16, 40, .24)] };
const REPORT = [];

async function syncColors() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const col = cols.find(c => c.name === 'ГИС · Цвета'); if (!col) return;
  const mode = col.modes[0].modeId; let n = 0;
  for (const k in DS_COLORS) { const v = V[k]; if (!v) continue; const c = rgb(DS_COLORS[k][1]); try { v.setValueForMode(mode, { r: c.r, g: c.g, b: c.b, a: 1 }); n++; } catch (e) { } }
  REPORT.push('цветов: ' + n);
}
async function syncNumbers() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find(c => c.name === 'ГИС · Размеры'); if (!col) col = figma.variables.createVariableCollection('ГИС · Размеры');
  const mode = col.modes[0].modeId;
  const ex = (await figma.variables.getLocalVariablesAsync('FLOAT')).filter(v => v.variableCollectionId === col.id);
  for (const [name, val] of Object.entries(DS_NUM)) { let v = ex.find(x => x.name === name); if (!v) v = figma.variables.createVariable(name, col, 'FLOAT'); v.setValueForMode(mode, val); N[name] = v; }
  REPORT.push('размеров: ' + Object.keys(DS_NUM).length);
}
async function syncText() {
  for (const st of ['Regular', 'Medium', 'Semi Bold']) await figma.loadFontAsync({ family: 'Inter', style: st });
  const styles = await figma.getLocalTextStylesAsync();
  for (const [k, [name, size, w]] of Object.entries(DS_TEXT)) {
    let s = styles.find(x => x.name === name); if (!s) { s = figma.createTextStyle(); s.name = name; }
    s.fontName = { family: 'Inter', style: w }; s.fontSize = size; S[k] = s; TS[k] = [name, size, w]; }
  REPORT.push('стилей текста: ' + Object.keys(DS_TEXT).length);
}
async function syncEffects() {
  const ex = await figma.getLocalEffectStylesAsync();
  for (const [name, eff] of Object.entries(DS_FX)) { let s = ex.find(x => x.name === name); if (!s) { s = figma.createEffectStyle(); s.name = name; } s.effects = eff; ST_FX[name] = s; }
  REPORT.push('теней: 3');
}
// Привязка размера к переменной (если среда не умеет — значение остаётся числом)
function bindN(node, fields, key) { const v = N[key]; if (!v) return; for (const f of [].concat(fields)) { try { node.setBoundVariable(f, v); } catch (e) { } } }
function padN(node, h, v) { if (h != null) bindN(node, ['paddingLeft', 'paddingRight'], 'Отступ/' + h); if (v != null) bindN(node, ['paddingTop', 'paddingBottom'], 'Отступ/' + v); }
function radN(node, r) { bindN(node, ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'], 'Радиус/' + r); }
function gapN(node, g) { bindN(node, 'itemSpacing', 'Отступ/' + g); }
// Компонент на auto layout
function comp(name, dir, o) {
  const c = figma.createComponent(); c.name = name; c.layoutMode = dir; c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'AUTO';
  c.itemSpacing = o.gap || 0; c.paddingLeft = c.paddingRight = o.px || 0; c.paddingTop = c.paddingBottom = o.py || 0; c.cornerRadius = o.r || 0;
  c.fills = o.bg ? [pv(o.bg)] : []; if (o.stroke) { c.strokes = [pv(o.stroke)]; c.strokeWeight = 1; c.strokeAlign = 'INSIDE'; }
  c.counterAxisAlignItems = o.align || 'CENTER'; if (o.justify) c.primaryAxisAlignItems = o.justify;
  // размер: resize фиксирует обе оси — после него явно задаём, какая ось «по содержимому»
  if (o.w || o.h) c.resize(o.w || 100, o.h || 100);
  if (dir === 'HORIZONTAL') { c.primaryAxisSizingMode = o.w ? 'FIXED' : 'AUTO'; c.counterAxisSizingMode = o.h ? 'FIXED' : 'AUTO'; }
  else { c.primaryAxisSizingMode = o.h ? 'FIXED' : 'AUTO'; c.counterAxisSizingMode = o.w ? 'FIXED' : 'AUTO'; }
  if (o.gap != null) gapN(c, o.gap); padN(c, o.px, o.py); if (o.r) radN(c, o.r);
  return c;
}
function setOf(comps, name, parent) { const s = figma.combineAsVariants(comps, parent); s.name = name; s.layoutMode = 'HORIZONTAL'; s.itemSpacing = 16; s.paddingLeft = s.paddingRight = s.paddingTop = s.paddingBottom = 16;
  s.primaryAxisSizingMode = 'AUTO'; s.counterAxisSizingMode = 'AUTO'; s.counterAxisAlignItems = 'CENTER'; s.fills = [pv('white')]; s.cornerRadius = 16; s.strokes = [pv('line')]; s.dashPattern = [6, 4]; return s; }
async function T(parent, str, style, color) { return TX(parent, str, style, color); }

async function buildComponents(row) {
  const made = {};
  // Кнопка
  const btns = [];
  for (const [v, bg, fg, st] of [['Основная', 'ink', 'white'], ['Светлая', 'white', 'ink', 'line'], ['Неактивная', 'dis', 'disT']]) {
    const c = comp('Вид=' + v, 'HORIZONTAL', { px: 24, r: 26, h: 52, w: 240, bg, stroke: st, justify: 'CENTER' });
    if (v === 'Основная') await fx(c, 'ГИС/Карточка на светлом');
    await T(c, v === 'Неактивная' ? 'Выбери название' : v === 'Светлая' ? 'Готово' : 'Поехали', 'btn', fg); btns.push(c); }
  made.btn = setOf(btns, 'Кнопка · v3', row);
  // Чип
  const chips = [];
  for (const [v, bg, fg, st] of [['Обычный', 'white', 'ink', 'line'], ['Выбран', 'ink', 'white'], ['Неактивен', 'dis', 'disT']]) {
    const c = comp('Состояние=' + v, 'HORIZONTAL', { px: v === 'Выбран' ? 12 : 16, gap: 8, r: 20, h: 40, bg, stroke: st });
    if (v === 'Выбран') c.appendChild(icoInst('Галочка', 'white'));
    await T(c, v === 'Неактивен' ? 'Отправить' : 'Работа', v === 'Выбран' ? 'bodyM' : 'body', fg); chips.push(c); }
  made.chip = setOf(chips, 'Чип · v3', row);
  // Пилюля итога
  const pills = [];
  for (const [v, bg, fg, t] of [['Надёжно', 'limeP', 'limeT', 'надёжно'], ['Риск', 'orange', 'orangeT', 'есть риск'], ['Опоздание', 'pinkL', 'pinkT', 'не успеешь'], ['Нейтрально', 'lav', 'lavT', 'по твоему темпу']]) {
    const c = comp('Итог=' + v, 'HORIZONTAL', { px: 12, py: 4, gap: 4, r: 13, bg }); await T(c, t, 'pill', fg); pills.push(c); }
  made.pill = setOf(pills, 'Пилюля · v3', row);
  // Переключатель
  const togs = [];
  for (const on of [true, false]) { const c = figma.createComponent(); c.name = 'Вкл=' + (on ? 'Да' : 'Нет'); c.resize(46, 28); c.cornerRadius = 14; c.fills = [pv(on ? 'violet' : 'togOff')];
    EL(c, on ? 32 : 14, 14, 11, 11, { fill: 'white', name: 'Ручка' }); togs.push(c); }
  made.tog = setOf(togs, 'Переключатель · v3', row);
  return made;
}
async function buildComponents2(row) {
  const made = {};
  // Плашка: подсказка / напоминание / срочно
  const hints = [];
  for (const [v, bg, st, t, s] of [['Подсказка', 'white', 'line', 'Дождь с 8:40', 'пешком чуть дольше, это уже в прогнозе'], ['Напоминание', 'lav', null, 'Через 10 мин выходить', 'Работа: метро, выйди до 8:23'], ['Срочно', 'warnBg', null, 'Пора выходить', 'Работа: метро, выйди до 8:23']]) {
    const c = comp('Вид=' + v, 'HORIZONTAL', { px: 12, py: 12, gap: 8, r: 14, bg, stroke: st, w: 328 });
    c.appendChild(icoInst(v === 'Подсказка' ? 'Дождь' : 'Колокол', 'ink'));
    const tx = AL(c, 'VERTICAL', { name: 'Текст', gap: 2 }); tx.layoutGrow = 1; await T(tx, t, 'bodyM', 'ink'); const sub = await T(tx, s, 'cap', v === 'Подсказка' ? 'ink2' : 'ink'); sub.layoutSizingHorizontal = 'FILL'; sub.textAutoResize = 'HEIGHT';
    await T(c, v === 'Подсказка' ? 'Модули' : 'Маршрут', 'bodyM', 'accent'); hints.push(c); }
  made.hint = setOf(hints, 'Плашка · v3', row); made.hint.layoutMode = 'VERTICAL';
  // Поле поиска
  const fields = [];
  for (const v of ['Пусто', 'Место']) {
    const c = comp('Состояние=' + v, 'HORIZONTAL', { px: 16, gap: 12, r: 24, h: 48, w: 272, bg: 'white' }); await fx(c, 'ГИС/Уровень 1');
    c.appendChild(icoInst('Поиск', v === 'Пусто' ? 'mute' : 'ink')); const t = await T(c, v === 'Пусто' ? 'Куда?' : 'м. Бауманская', v === 'Пусто' ? 'body' : 'bodyM', v === 'Пусто' ? 'mute' : 'ink'); t.layoutGrow = 1;
    if (v === 'Место') c.appendChild(icoInst('Закрыть', 'ink2'));
    fields.push(c); }
  made.field = setOf(fields, 'Поле поиска · v3', row); made.field.layoutMode = 'VERTICAL';
  // Строка списка (шаблон / недавнее)
  const rows = [];
  for (const [v, ic, t, s, r] of [['Шаблон', 'Работа', 'Работа', 'Отсюда → м. Бауманская · к 9:00 · пн–пт', 'выйди до\n8:23'], ['Недавнее', 'История', 'м. Бауманская', 'Арбатско-Покровская линия', null]]) {
    const c = comp('Вид=' + v, 'HORIZONTAL', { px: 12, py: 12, gap: 12, r: 16, bg: 'white', stroke: 'line', w: 328 });
    const ib = AL(c, 'HORIZONTAL', { name: 'Иконка', pad: 12, r: 12, bg: 'lav' }); ib.appendChild(icoInst(ic, 'accent'));
    const tx = AL(c, 'VERTICAL', { name: 'Текст', gap: 2 }); tx.layoutGrow = 1; await T(tx, t, 'bodyM', 'ink'); const sb = await T(tx, s, 'small', 'mute'); sb.layoutSizingHorizontal = 'FILL'; sb.textAutoResize = 'HEIGHT';
    if (r) { const rr = AL(c, 'VERTICAL', { name: 'Справа', align: 'MAX' }); const [a, b] = r.split('\n'); await T(rr, a, 'small', 'mute'); await T(rr, b, 'bodyM', 'accent'); }
    rows.push(c); }
  made.lrow = setOf(rows, 'Строка списка · v3', row); made.lrow.layoutMode = 'VERTICAL';
  // Карточка способа
  const cards = [];
  for (const [v, ic, n, d, top, main, sub, pl] of [['Обычная', 'Метро', 'Метро', '5 остановок · ≈ 70 ₽', 'выйди до', '8:23', 'ещё 3 мин', [['limeP', 'limeT', 'надёжно'], ['lav', 'lavT', 'в пути ~33 мин']]],
      ['Риск', 'Такси', 'Такси', 'подача 3–9 мин · ≈ 650 ₽', 'вызывай', 'сейчас', 'будешь ~8:54', [['orange', 'orangeT', 'риск из-за пробок']]],
      ['Закрыта', 'Метро', 'Метро', '5 остановок без пересадок', 'вход', 'до 1:00', 'не успеть', [['lav', 'lavT', 'закроется раньше']]]]) {
    const c = comp('Вид=' + v, 'VERTICAL', { px: 16, py: 16, gap: 12, r: 18, bg: v === 'Закрыта' ? 'soft' : 'white', w: 328, align: 'MIN' }); if (v !== 'Закрыта') await fx(c, 'ГИС/Карточка на светлом');
    const top0 = AL(c, 'HORIZONTAL', { name: 'Строка', gap: 12, align: 'CENTER' }); top0.layoutSizingHorizontal = 'FILL'; gapN(top0, 12);
    const ib = AL(top0, 'HORIZONTAL', { name: 'Иконка', pad: 8, r: 12, bg: 'lav' }); ib.appendChild(icoInst(ic, 'accent'));
    const tx = AL(top0, 'VERTICAL', { name: 'Текст', gap: 2 }); tx.layoutGrow = 1; await T(tx, n, 'bodyM', 'ink'); const dd = await T(tx, d, 'small', 'mute'); dd.layoutSizingHorizontal = 'FILL'; dd.textAutoResize = 'HEIGHT';
    const rr = AL(top0, 'VERTICAL', { name: 'Справа', align: 'MAX' }); await T(rr, top, 'small', 'mute'); await T(rr, main, 'big', v === 'Закрыта' ? 'closedT' : 'ink'); await T(rr, sub, 'small', 'mute');
    const pr = AL(c, 'HORIZONTAL', { name: 'Итог', gap: 8 }); gapN(pr, 8);
    for (const [bg, fg, t] of pl) { const p = AL(pr, 'HORIZONTAL', { name: 'Пилюля', px: 12, py: 4, r: 13, bg }); await T(p, t, 'pill', fg); }
    if (v === 'Закрыта') { top0.opacity = 0.55; pr.opacity = 0.55; }
    cards.push(c); }
  made.card = setOf(cards, 'Карточка способа · v3', row);
  return made;
}
// ---------- Справочник ----------
async function section(parent, title, note) { const s = AL(parent, 'VERTICAL', { name: 'Раздел: ' + title, gap: 12, fill: true }); await TX(s, title, 'title', 'ink'); if (note) await TX(s, note, 'cap', 'mute', { fill: true }); return s; }
async function swatches(parent) {
  const g = AL(parent, 'HORIZONTAL', { name: 'Палитра', gap: 12, wrap: true, fill: true }); g.primaryAxisSizingMode = 'FIXED';
  for (const k of Object.keys(DS_COLORS)) { const [name, hex] = DS_COLORS[k];
    const c = AL(g, 'VERTICAL', { name, gap: 8, pad: 8, r: 14, bg: 'white', stroke: 'line', w: 160 });
    const sw = figma.createRectangle(); sw.name = 'Цвет'; sw.resize(144, 56); sw.cornerRadius = 10; sw.fills = [pv(k)]; if (hex.toUpperCase() === '#FFFFFF') { sw.strokes = [pv('line')]; sw.strokeWeight = 1; } c.appendChild(sw);
    await TX(c, name, 'small', 'ink', { fill: true }); await TX(c, hex.toUpperCase(), 'tiny', 'mute'); }
}
async function typeScale(parent) {
  for (const k of ['title', 'big', 'btn', 'bodyM', 'body', 'cap', 'pill', 'small', 'tiny']) { const [name, size, w] = DS_TEXT[k];
    const r = AL(parent, 'HORIZONTAL', { name, gap: 24, align: 'CENTER' }); const a = await TX(r, name + ' · ' + size + ' · ' + w, 'small', 'mute'); a.resize(220, a.height); a.textAutoResize = 'HEIGHT';
    await TX(r, 'Выходи до 8:23 — будешь в 8:56', k, 'ink'); }
}
async function spacing(parent) {
  const r = AL(parent, 'HORIZONTAL', { name: 'Шкала отступов', gap: 16, align: 'MAX' });
  for (const n of [2, 4, 8, 12, 16, 24, 32]) { const c = AL(r, 'VERTICAL', { name: 'Отступ ' + n, gap: 8, align: 'CENTER' });
    const b = figma.createRectangle(); b.name = n + ' px'; b.resize(n, n); b.fills = [pv('violet')]; c.appendChild(b); await TX(c, String(n), 'small', 'ink'); }
  await TX(parent, '4-px сетка: все отступы кратны 4. 2 px — только для микродеталей (метка «Лучше всего»). Края экрана — 16, внутри карточек — 16, между карточками — 12, у пилюль — 4 × 12, у чипов — 16 по бокам, между чипами — 8.', 'cap', 'mute', { fill: true });
}
async function radii(parent) {
  const r = AL(parent, 'HORIZONTAL', { name: 'Радиусы', gap: 16, align: 'MAX' });
  for (const [n, what] of [[10, 'ориентир'], [13, 'пилюля'], [14, 'плашка'], [18, 'карточка'], [20, 'чип'], [24, 'поле'], [26, 'кнопка']]) {
    const c = AL(r, 'VERTICAL', { name: 'Радиус ' + n, gap: 8, align: 'CENTER' });
    const b = figma.createRectangle(); b.resize(64, 48); b.cornerRadius = n; b.fills = [pv('lav')]; c.appendChild(b); await TX(c, n + ' · ' + what, 'small', 'ink'); }
}
async function shadows(parent) {
  const r = AL(parent, 'HORIZONTAL', { name: 'Тени', gap: 24, pad: 24, r: 16, bg: 'soft' });
  for (const [n, what] of [['ГИС/Карточка на светлом', 'карточки на подложке'], ['ГИС/Уровень 1', 'поиск и чипы над картой'], ['ГИС/Уровень 3', 'шторка']]) {
    const c = AL(r, 'VERTICAL', { name: n, gap: 4, pad: 16, r: 18, bg: 'white', w: 220 }); await fx(c, n); await TX(c, n, 'bodyM', 'ink', { fill: true }); await TX(c, what, 'small', 'mute', { fill: true }); }
}
async function iconsGrid(parent) {
  const g = AL(parent, 'HORIZONTAL', { name: 'Иконки', gap: 8, wrap: true, fill: true }); g.primaryAxisSizingMode = 'FIXED';
  for (const n of Object.keys(ICONS)) { const c = AL(g, 'VERTICAL', { name: n, gap: 4, pad: 8, r: 12, bg: 'soft', align: 'CENTER', w: 96 }); c.appendChild(icoInst(n, 'accent')); await TX(c, n, 'tiny', 'ink'); }
}

(async () => {
  for (const st of ['Regular', 'Medium', 'Semi Bold']) await figma.loadFontAsync({ family: 'Inter', style: st });
  await setupVariables(); await syncColors(); await syncNumbers(); await setupTextStyles(); await syncText(); await loadLibrary(); await loadEffects(); await syncEffects();
  await figma.setCurrentPageAsync(CP);
  let holder = CP.findOne(n => n.type === 'FRAME' && n.name === 'Иконки');
  const bottom0 = CP.children.reduce((mx, n) => Math.max(mx, n.y + n.height), 0);
  if (!holder) holder = AL(CP, 'HORIZONTAL', { name: 'Иконки', gap: 16, pad: 20, r: 16, bg: 'white', align: 'CENTER', x: 0, y: bottom0 + 48 });
  Object.keys(NEW_ICONS).filter(updateIcon); buildIcons(holder);
  const base = 'ГИС · Дизайн-система v3';
  let name = base, k = 2; while (figma.root.children.some(p => p.name === name)) name = base + ' (' + (k++) + ')';
  PG = figma.createPage(); PG.name = name; await figma.setCurrentPageAsync(PG);
  const doc = AL(PG, 'VERTICAL', { name: 'Дизайн-система v3', gap: 48, pad: 48, r: 32, bg: 'white', x: 0, y: 0, w: 1440 });
  await TX(doc, 'Своя ГИС — дизайн-система v3', 'title', 'ink');
  await TX(doc, 'Источник правды — прототип. Цвета, текст, тени и размеры — переменные и стили файла: поменяешь здесь — обновятся все макеты. Отступы и радиусы компонентов привязаны к переменным «ГИС · Размеры».', 'body', 'ink2', { fill: true });
  await swatches(await section(doc, 'Цвета', 'Лайм — только «надёжно». Оранжевый — риск, розовый — опоздание, лаванда — нейтральное. Выбранное — тёмный (ink) с галочкой. Неактивное — светлая лаванда.'));
  await typeScale(await section(doc, 'Текст', 'Inter. Заголовки и акценты — Semi Bold (600), как в прототипе.'));
  await spacing(await section(doc, 'Отступы'));
  await radii(await section(doc, 'Радиусы'));
  await shadows(await section(doc, 'Тени'));
  const cs = await section(doc, 'Компоненты', 'Все состояния — варианты одного компонента. Отступы и радиусы привязаны к переменным.');
  const r1 = AL(cs, 'HORIZONTAL', { name: 'Ряд 1', gap: 24, wrap: true, fill: true }); r1.primaryAxisSizingMode = 'FIXED';
  await buildComponents(r1);
  const r2 = AL(cs, 'HORIZONTAL', { name: 'Ряд 2', gap: 24, wrap: true, fill: true, align: 'MIN' }); r2.primaryAxisSizingMode = 'FIXED';
  await buildComponents2(r2);
  await iconsGrid(await section(doc, 'Иконки', '20×20 · линия 1.75 · скруглённые концы · цвет — через обводку.'));
  figma.viewport.scrollAndZoomIntoView([doc]);
  const warn = SET_ISSUES.size ? ' · ⚠ ' + [...SET_ISSUES].slice(0, 2).join('; ') : '';
  figma.closePlugin('Готово: «' + name + '» — ' + REPORT.join(', ') + '; 8 компонентов v3' + warn);
})().catch(e => figma.closePlugin('Ошибка: ' + (e && e.message ? e.message : e)));
