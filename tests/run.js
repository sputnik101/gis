// Автопроверки прототипа «Своя ГИС». Запуск: node tests/run.js [путь к index.html]
// Нужны playwright и Chrome (CHROME=/путь/к/chrome). Сеть не нужна: карта не загрузится — проверяется логика.
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const T = [];
const test = (name, fn) => T.push({ name, fn });

// ---------- модули ----------
test('сломанный модуль не ломает экран и отключается', async p => p.evaluate(() => {
  registerModule({ id:'broken', icon:'💥', name:'Сломанный', desc:'', where:'', on:true,
    context(){ throw new Error('a'); }, legFactor(){ throw new Error('b'); }, banners(){ throw new Error('c'); }, stepHints(){ throw new Error('d'); } });
  const t0 = performance.now(); openPlace('baum'); go('compare'); const ms = performance.now() - t0;
  const ok = document.querySelectorAll('.card').length === 4 && ms < 800 && MODULES.find(m=>m.id==='broken').__broken;
  unregisterModule('broken'); return ok || ('cards/ms/broken: ' + document.querySelectorAll('.card').length + '/' + Math.round(ms));
}));
test('выключение модуля без context() пересчитывает прогноз', async p => p.evaluate(() => {
  const base = forecast('walk').mid;
  registerModule({ id:'slow', icon:'🐢', name:'Медленно', desc:'', where:'', on:true, legFactor(l){ return l.type==='walk' ? 2 : 1; } });
  const on = forecast('walk').mid; toggleMod('slow'); const off = forecast('walk').mid; unregisterModule('slow');
  return (on > base * 1.5 && off === base) || `base ${base} on ${on} off ${off}`;
}));
test('модуль влияет и на шаг «вход, платформа и поезд»', async p => p.evaluate(() => {
  const base = forecast('metro').mid;
  registerModule({ id:'board2', icon:'🛗', name:'Посадка', desc:'', where:'', on:true, legFactor(l){ return l.model==='board' ? 2 : 1; } });
  const on = forecast('metro').mid; unregisterModule('board2'); return on > base || `base ${base} on ${on}`;
}));
test('мусорные ответы модулей отбрасываются, множитель ограничен', async p => p.evaluate(() => {
  registerModule({ id:'junk', icon:'?', name:'Мусор', desc:'', where:'', on:true,
    banners(){ return 'строка'; }, cardPills(){ return [{}, 5, null]; }, pois(){ return [{}]; }, legFactor(){ return Infinity; } });
  openPlace('baum'); go('compare'); const txt = document.body.innerText, mid = forecast('metro').mid;
  unregisterModule('junk');
  return (!/undefined|\[object Object\]/.test(txt) && Number.isFinite(mid) && mid > 0) || 'text/mid: ' + mid;
}));
test('повторная регистрация того же id — замена', async p => p.evaluate(() => {
  const n = MODULES.length; const m = MODULES.find(x => x.id==='weather'); registerModule(Object.assign({}, m)); return MODULES.length === n || 'стало ' + MODULES.length;
}));
test('удалённый модуль не оставляет следов', async p => p.evaluate(() => {
  registerModule({ id:'tmp', icon:'•', name:'Временный', desc:'', where:'', on:true }); unregisterModule('tmp');
  go('modules'); const ok = !('tmp' in state.modules) && !document.body.innerText.includes('Временный'); back(); return ok;
}));
test('текст модулей и поиска не исполняется как код (XSS)', async p => p.evaluate(() => {
  window.__x = 0;
  registerModule({ id:'xss', icon:'<img src=x onerror="window.__x=1">', name:'<img src=x onerror="window.__x=1">', desc:'', where:'', on:true,
    banners(){ return [{ icon:'!', title:'<img src=x onerror="window.__x=1">', text:'' }]; } });
  openPlace('baum'); go('compare'); go('modules'); back(); unregisterModule('xss');
  state.q = '"><img src=x onerror="window.__x=1">'; go('find'); back();
  return new Promise(r => setTimeout(() => r(window.__x === 0 || 'выполнился код'), 300));
}));
test('подсказки модулей видны в «Погулять рядом»', async p => p.evaluate(() => {
  restart(); walkNearby(); return document.querySelectorAll('.hint').length > 0 || 'нет подсказки о дожде на прогулке';
}));
// ---------- способы передвижения — тоже модули ----------
test('выключенное такси исчезает отовсюду', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); toggleMod('taxi');
  const ok = !document.body.innerText.includes('Такси') && !OPTIONS.taxi && document.querySelectorAll('.card').length === 3;
  toggleMod('taxi'); return ok || 'карточек ' + document.querySelectorAll('.card').length;
}));
test('все способы выключены — понятное пустое состояние', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); ['metro','walk','taxi','carshare'].forEach(toggleMod);
  const ok = document.body.innerText.includes('Нет включённых способов') && !document.querySelectorAll('.card[data-k]').length;
  ['metro','walk','taxi','carshare'].forEach(toggleMod); return ok || 'нет пустого состояния';
}));
test('без метро нет «метро + прогулки» и подсказки о загрузке вагонов', async p => p.evaluate(() => {
  toggleMod('metro'); walkNearby(); const noStroll = !OPTIONS.stroll && !document.body.innerText.includes('прогулка у Яузы');
  const noCrowd = !activeModules().some(m => m.id === 'crowd'); toggleMod('metro'); return (noStroll && noCrowd) || 'stroll/crowd остались';
}));
test('ночью метро «закрыто», лучший способ — другой', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=1440+180; render();
  const t = document.body.innerText; return (t.includes('закрыто') && bestOption(goKeys()) !== 'metro') || 'best ' + bestOption(goKeys());
}));
test('прогноз метро к 9:00 не изменился (33 мин, выйди до 8:23)', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render();
  const f = forecast('metro'), v = verdict('metro'); return (f.mid === 33 && fmt(v.L) === '8:23') || `${f.mid} / ${fmt(v.L)}`;
}));
test('шаблон с выключенным способом не ломает главный экран', async p => p.evaluate(() => {
  resetDemo(); state.templates.push({ name:'Работа', dest:'baum', arrive:540, mode:'metro' }); toggleMod('metro'); restart();
  const ok = document.body.innerText.includes('выключен'); toggleMod('metro'); return ok || 'нет пометки';
}));
test('«Вагон для выхода»: подсказка есть, выключил — пропала, без метро — не работает', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); pick('metro');
  const on = document.body.innerText.includes('Садись в первые вагоны');
  toggleMod('cars'); const off = !document.body.innerText.includes('Садись в первые вагоны'); toggleMod('cars');
  toggleMod('metro'); const dep = !activeModules().some(m => m.id==='cars'); toggleMod('metro');
  walkNearby(); pick('stroll'); const silent = !document.body.innerText.includes('Садись в');   // до Электрозаводской данных нет — молчит
  return (on && off && dep && silent) || JSON.stringify({on, off, dep, silent});
}));
// ---------- навигация ----------
test('место → поиск → место: на экране место', async p => p.evaluate(() => {
  restart(); openPlace('baum'); go('find'); openPlace('baum');
  return (state.view==='place' && document.querySelector('h1').textContent.includes('Бауманская')) || 'view ' + state.view;
}));
test('прогулка → поездка → завершить → назад ×2 без ошибок', async p => {
  await p.evaluate(() => { restart(); walkNearby(); pick('loop'); return startTrip(); });
  await p.waitForTimeout(300);
  return p.evaluate(() => { endTrip(); endTrip(); back(); back(); return (state.view==='home') || 'view ' + state.view; });
});
test('после «Завершить» «назад» ведёт туда, откуда пришли', async p => {
  await p.evaluate(() => { resetDemo(); openPlace('baum'); go('compare'); pick('metro'); return startTrip(); });
  await p.waitForTimeout(300);
  return p.evaluate(() => { endTrip(); endTrip(); back(); return state.view==='compare' || 'view ' + state.view; });
});
test('сохранение маршрута и шаблон под поиском', async p => p.evaluate(() => {
  resetDemo(); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render(); pick('metro');
  go('save'); saveTemplate(); saveReverse(false); restart();
  return (state.templates.length===1 && document.body.innerText.includes('выйди до')) || 'шаблонов ' + state.templates.length;
}));
test('сброс демо — чистый первый запуск', async p => p.evaluate(() => {
  state.saveName = 'Спорт'; resetDemo(); return (!state.templates.length && !state.recents.length && !state.saveName) || 'не сброшено';
}));
// ---------- прогноз ----------
test('сумма минут шагов = обычному времени', async p => p.evaluate(() => {
  const bad = ['metro','taxi','carshare','walk','stroll','loop'].filter(k => forecast(k).legMins.reduce((a,b)=>a+b,0) !== forecast(k).mid);
  return !bad.length || 'не сходится: ' + bad.join(', ');
}));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let fail = 0;
  for(const t of T){
    const p = await b.newPage({ viewport: { width: 430, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(file); await p.waitForTimeout(600);
    let res; try { res = await t.fn(p); } catch(e){ res = e.message.split('\n')[0]; }
    await p.waitForTimeout(100);
    const ok = res === true && !errs.length;
    if(!ok) fail++;
    console.log((ok ? '✓ ' : '✗ ') + t.name + (ok ? '' : '  → ' + (res === true ? '' : res) + (errs.length ? ' · ошибки: ' + errs.join('; ') : '')));
    await p.close();
  }
  await b.close();
  console.log(fail ? `\nНе прошло: ${fail} из ${T.length}` : `\nВсё прошло: ${T.length} проверок`);
  process.exit(fail ? 1 : 0);
})();
