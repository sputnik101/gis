// Мутационная проверка набора tests/run.js (лежит рядом: tests/mutants.js; копии — в tests/mutants/, их не коммитить): портим по одной функции и смотрим, заметят ли автопроверки.
// Запуск: node tests/mutants.js (нужны playwright и Chrome, ~20 минут)
// Итог: «выжил» = набор прошёл, хотя функция сломана (слабое место набора).
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Убраны как равносильные (поломка ничего не меняет): resetDemo без store.clear() — хранилища чистит цикл по localStorage;
// ключ без фактов модулей — пересчёт по новым данным идёт через refreshModules(), он сбрасывает ключ сам.
const M = [
  ['нет лимитов шлюза (2 подсказки/пилюли, 6 точек)', 'return out.slice(0, LIMIT[hook]); }', 'return out; }'],
  ['нет ограничения множителя 0,5–3', 'return Math.min(3, Math.max(0.5, k)); }', 'return k; }'],
  ['нет защиты от двойного тапа (navLock)', 'if(performance.now() < navLock){', 'if(false){'],
  ['нет защиты от второго startTrip', '  if(trip.on) return;\n  // история', '  // история'],
  ['«Завершить» в одно нажатие', 'if(!b.dataset.armed || performance.now() - b.dataset.armed < 600){', 'if(false){'],
  ['пропало «завтра»', "(m >= DAY ? ' завтра' : '')", "''"],
  ['«Загруженность вагонов» никогда не срабатывает', 't >= 8*60+25 && t < 8*60+55', 'false'],
  ['метро закрывается в 0:30 вместо 1:00', "[   0,   60, 'поздно вечером', 7  ], [  60,  330,", "[   0,   30, 'поздно вечером', 7  ], [  30,  330,"],
  ['шлюз точек не проверяет координаты и имя', 'x && x.n && Array.isArray(x.at) && x.at.length === 2 && x.at.every(Number.isFinite) ?', 'x ?'],
  ['текст подсказки шага не экранируется', "${esc(h.text)}</div>`).join('')}${l.lm", "${h.text}</div>`).join('')}${l.lm"],
  ['дождь не замедляет пешком', "l.type==='walk' ? 1.06 : 1", '1'],
  ['визиты не считаются (предложение сохранить после 2-й поездки)', 'if(state.dest) state.visits[state.dest] = (state.visits[state.dest]||0) + 1;', ''],
  ['«Не сейчас» игнорируется', '!state.declined[state.dest] && ', ''],
  ['после поездки шторка остаётся inert', 'tb.inert = false; sheet.inert = false;', 'tb.inert = false;'],
  ['«надёжно» уже при 50%', 'if(p >= 0.95) return', 'if(p >= 0.5) return'],
  ['«Всё как обычно» не исключает остальные', 'if(b.dataset.only) a.sel = a.sel.includes(c) ? [] : [c];', ''],
  ['выход из «Погулять рядом» не возвращает режим', "if(from==='compare' && state.view!=='compare' && state.mode==='walk'){ state.mode = 'hurry'; }", ''],
  ['ключ прогноза не учитывает время', "const key = Math.round(T) + '|' + parts.join(';');", "const key = parts.join(';');"],
  ['хранилище без проверки по схеме', 'return { get(){ const v = raw(); return v == null && !schema ? null : fitSchema(v, schema); },', 'return { get(){ const v = raw(); return v == null ? (schema ? fitSchema(null, schema) : null) : v; },'],
  ['ядро берёт объект модуля, а не копию', 'try{ OPTIONS[k] = snapOption(o); }', 'try{ OPTIONS[k] = o; }'],
  ['шлюз пропускает нулевое время', "if(!(o.legs.reduce((a, l) => a + l.hi, 0) > 0)) return 'у маршрута нулевое время';", ''],
  ['выключение без предупреждения о зависимых', "if(deps.length && state.modOff !== k){", "if(false){"],
  ['«Включить» не включает зависимости', "if(!state.modules[k]){ enableMods(needsOf(k)); return; }", "if(!state.modules[k]){ enableMods([k]); return; }"],
  ['шаблоны не сохраняются между сеансами', 'syncCtx(); if(APP_READY) saveApp();', 'syncCtx();'],
  ['use() без проверки requires', "if(!(m.requires || []).includes(id)){ console.warn", "if(false){ console.warn"],
  ['метро у закрытия — «ночью не ходит»', "if(!P.iv && tm < 60 + 20) o.closedInfo", "if(false) o.closedInfo"],
  ['крестик на месте не закрывает место', "function closePlace(){ state.dest = null; state.sel = null; restart();", "function closePlace(){"],
  ['каршеринг без подтверждения перед бронью', "confirm:{ crumb:'Бронь машины'", "noconfirm:{ crumb:'Бронь машины'"],
];
const dir = path.join(__dirname, 'mutants'); fs.mkdirSync(dir, { recursive: true });
const runOne = (i) => new Promise(res => {
  const [name, a, b] = M[i]; if(!src.includes(a)) return res(`?? «${name}»: образец не найден`);
  const f = path.join(dir, 'm' + i + '.html'); fs.writeFileSync(f, src.replace(a, b));
  execFile('node', [path.join(__dirname, '..', 'tests', 'run.js'), f], { env: process.env, timeout: 300000 }, (err, out) => {
    const failed = (out.match(/^✗ .*/gm) || []).map(s => s.slice(2, 60));
    res((failed.length ? 'убит   ' : 'ВЫЖИЛ  ') + name + (failed.length ? '  ← ' + failed.slice(0, 2).join(' | ') : ''));
  }); });
(async () => { const out = new Array(M.length); let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => { while(next < M.length){ const i = next++; out[i] = await runOne(i); console.error(out[i]); } }));
  console.log('\n' + out.join('\n')); console.log('\nВыжило: ' + out.filter(s => s.startsWith('ВЫЖИЛ')).length + ' из ' + M.length);
})();
