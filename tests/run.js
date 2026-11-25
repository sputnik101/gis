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
test('такси выключили на маршруте — честно возвращаем к способам, без подмены', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); pick('taxi'); go('modules'); toggleMod('taxi'); back();
  const ok = state.view==='compare' && !document.body.innerText.includes('Такси до Бауманской'); toggleMod('taxi');
  back(); return (ok && state.view==='place') || 'view ' + state.view + ' hist ' + state.history;
}));
test('такси выключили на подтверждении — к способам, «назад» один раз', async p => p.evaluate(() => {
  restart(); openPlace('baum'); go('compare'); pick('taxi'); go('confirm'); go('modules'); toggleMod('taxi'); back();
  const ok = state.view==='compare'; back(); toggleMod('taxi'); return (ok && state.view==='place') || 'view ' + state.view;
}));
test('способ пропал во время поездки — поездка идёт до конца на своей копии', async p => {
  await p.evaluate(() => { restart(); openPlace('baum'); go('compare'); pick('taxi'); return startTrip(true); });
  await p.waitForTimeout(300);
  return p.evaluate(() => { unregisterModule('taxi'); trip.t = 10; update(0); const mid = document.getElementById('gtop').innerText;
    const ok = /Такси|Подача|В пути/.test(mid) && !/NaN/.test(document.body.innerText); return ok || mid; });
});
test('«Пешком» выключили на маршруте прогулки — к способам', async p => p.evaluate(() => {
  restart(); walkNearby(); pick('stroll'); toggleMod('walk'); render();
  const ok = state.view==='compare'; toggleMod('walk'); return ok || 'view ' + state.view;
}));
test('вариант способа с мусором или разметкой не попадает в приложение', async p => p.evaluate(() => {
  window.__x = 0;
  registerModule({ id:'junkmode', group:'mode', icon:'?', name:'Мусор', desc:'', where:'', on:true, options:{ junk:{ name:'J', purpose:'go', legs:[{}] } } });
  registerModule({ id:'xssmode', group:'mode', icon:'?', name:'XSS', desc:'', where:'', on:true,
    options:{ xss:{ name:'<img src=x onerror="window.__x=1">', purpose:'go', legs:[{type:'walk', geom:'walkAll', lo:1, hi:2, label:'x'}] } } });
  openPlace('baum'); go('compare');
  const ok = !OPTIONS.junk && !OPTIONS.xss && document.querySelectorAll('.card').length === 4 && window.__x === 0;
  unregisterModule('junkmode'); unregisterModule('xssmode'); return ok || 'варианты: ' + Object.keys(OPTIONS);
}));
test('чужой ключ варианта не затирает существующий', async p => p.evaluate(() => {
  registerModule({ id:'taxi2', group:'mode', icon:'?', name:'Другое', desc:'', where:'', on:true,
    options:{ taxi:{ name:'Другое такси', purpose:'go', legs:[{type:'car', geom:'taxiDrive', lo:1, hi:2, label:'x'}] } } });
  syncCtx(); SYNC_KEY = null; syncCtx(); const ok = OPTIONS.taxi.name === 'Такси'; unregisterModule('taxi2'); return ok || OPTIONS.taxi.name;
}));
test('ночью закрытое метро — в конце списка, не открывается; на маршруте — другие способы', async p => p.evaluate(() => {
  restart(); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=1440+180; render();
  const cards = [...document.querySelectorAll('.card[data-k]')].map(c => c.dataset.k);
  const last = cards[cards.length-1]==='metro' && document.querySelector('.card[data-k=metro]').tagName !== 'BUTTON';
  state.sel='metro'; go('route'); const alt = document.body.innerText.includes('Сейчас можно так') && !document.body.innerText.includes('Сохранить маршрут');
  return (last && alt) || JSON.stringify({cards, last, alt});
}));
test('«Сохранить» без способа не падает', async p => p.evaluate(() => {
  restart(); openPlace('baum'); state.sel = null; go('save'); return document.body.innerText.includes('Сначала выбери способ') || 'нет сообщения';
}));
test('шаблон открывает сразу маршрут сохранённым способом, «назад» — к способам', async p => p.evaluate(() => {
  resetDemo(); state.templates.push({ name:'Работа', dest:'baum', arrive:540, mode:'metro' }); restart(); useTemplate(0);
  const r = state.view==='route' && state.sel==='metro'; back(); const c = state.view==='compare'; back();
  return (r && c && state.view==='home') || 'view ' + state.view;
}));
test('«Поехали» видна без прокрутки на маршруте', async p => { await p.evaluate(() => { restart(); openPlace('baum'); go('compare'); pick('metro'); }); await p.waitForTimeout(500);
  return p.evaluate(() => { const b = document.getElementById('goBtn').getBoundingClientRect(), ph = document.getElementById('phone').getBoundingClientRect(); return (b.bottom <= ph.bottom && b.top > ph.top) || 'кнопка за краем'; }); });
test('без «Пешком» нет подсказки о дожде и чипа «Погулять рядом»', async p => p.evaluate(() => {
  toggleMod('walk'); restart(); const chip = !!document.querySelector('.wchip'); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render();
  const rain = document.body.innerText.includes('Дождь'); toggleMod('walk'); return (!chip && !rain) || JSON.stringify({chip, rain});
}));
// ---------- калибровка «Мой темп» ----------
const tripDone = async (p, k) => { await p.evaluate(k => { restart(); openPlace('baum'); go('compare'); pick(k); return startTrip(true); }, k); await p.waitForTimeout(300);
  await p.evaluate(() => { trip.t = trip.total; }); await p.waitForTimeout(1200); };
test('после первой поездки — «Как ты обычно ходишь?»; «Быстро» ускоряет пешие шаги', async p => {
  const before = await p.evaluate(() => { openPlace('baum'); go('compare'); return forecast('walk').mid; });
  await tripDone(p, 'metro');
  return p.evaluate(before => { const q = document.body.innerText.includes('Как ты обычно ходишь?');
    document.querySelector('[data-c=fast]').click(); const res = document.body.innerText.includes('Учёл');
    const after = forecast('walk').mid; return (q && res && after < before) || JSON.stringify({q, res, before, after}); }, before);
});
test('дальше — «Что-то задержало?»: несколько причин, «Всё как обычно» исключает остальные', async p => {
  await tripDone(p, 'metro'); await p.evaluate(() => document.querySelector('[data-c=usual]').click());
  await tripDone(p, 'metro');
  return p.evaluate(() => { const q = document.body.innerText.includes('Что-то задержало?');
    document.querySelector('[data-c=wait]').click(); document.querySelector('[data-c=escal]').click();
    const two = state.modAns.pace.sel.length === 2; document.querySelector('[data-c=ok]').click(); const only = state.modAns.pace.sel.join() === 'ok';
    document.querySelector('[data-c=ok]').click(); document.querySelector('[data-c=wait]').click();
    const m0 = forecast('metro').mid; sendAns('pace'); const m1 = forecast('metro').mid;
    return (q && two && only && m1 > m0) || JSON.stringify({q, two, only, m0, m1}); });
});
test('«Мой темп» выключен — вопроса нет, прогноз общий; настройки и сброс работают', async p => {
  await tripDone(p, 'metro'); await p.evaluate(() => document.querySelector('[data-c=slow]').click());
  return p.evaluate(() => { openPlace('baum'); go('compare'); const tuned = forecast('walk').mid;
    toggleMod('pace'); const plain = forecast('walk').mid; toggleMod('pace');
    go('modules'); openModSet('pace'); const set = document.body.innerText.includes('Пешком') && document.body.innerText.includes('+15%');
    resetMod('pace'); const reset = forecast('walk').mid === plain;
    return (tuned > plain && set && reset) || JSON.stringify({tuned, plain, set, reset}); });
});
test('модуль с ошибкой «после поездки» не ломает экран «Ты на месте»', async p => {
  await p.evaluate(() => registerModule({ id:'badq', icon:'?', name:'Плохой вопрос', desc:'', where:'', on:true, afterTrip(){ throw new Error('x'); } }));
  await tripDone(p, 'taxi');
  return p.evaluate(() => (state.view==='done' && document.body.innerText.includes('Ты на месте')) || 'view ' + state.view);
});
test('новый способ по инструкции (велосипед) — без правок ядра: карточка, маршрут, поездка', async p => {
  await p.evaluate(() => {
    // ровно пример из docs/modules.md
    registerModule({
      id:'bike', group:'mode', icon:'Шаги', name:'Велосипед', desc:'Велопрокат', where:'способы', on:true,
      options: { bike: { name:'Велосипед', ico:'Шаги', price:'≈ 150 ₽', purpose:'go', order:5, detail:'станция в 200 м',
        legs:[
          { type:'walk', label:'До станции проката', lo:3, hi:4, coords:[[37.8111,55.79271],[37.8090,55.7925]] },
          { type:'wait', label:'Взять велосипед', lo:1, hi:3, at:[37.8090,55.7925], parts:[{ tri:[1,2] }, { chance:0.1, add:3 }] },
          { type:'car', label:'На велосипеде до Бауманской', lo:28, hi:38, coords:[[37.8090,55.7925],[37.75,55.788],[37.67876,55.77235]], lm:'По выделенной полосе' } ] } } });
    restart(); openPlace('baum'); go('compare'); pick('bike'); });
  const route = await p.evaluate(() => state.view==='route' && document.body.innerText.includes('На велосипеде до Бауманской'));
  await p.evaluate(() => startTrip()); await p.waitForTimeout(300); await p.evaluate(() => { trip.t = trip.total; }); await p.waitForTimeout(1200);
  return p.evaluate(route => (route && state.view==='done' && !/NaN|undefined/.test(document.body.innerText)) || 'route ' + route + ' view ' + state.view, route);
});
test('«Пробки» выключены — такси и каршеринга нет (зависят от данных), метро и пешком есть', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); toggleMod('roads');
  const ok = !OPTIONS.taxi && !OPTIONS.carshare && !!OPTIONS.metro && !!OPTIONS.walk; toggleMod('roads'); return ok || Object.keys(OPTIONS).join();
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
  go('save'); state.saveName='Работа'; saveTemplate(); saveReverse(false); restart();
  return (state.templates.length===1 && document.body.innerText.includes('выйди до')) || 'шаблонов ' + state.templates.length;
}));
test('сброс демо — чистый первый запуск: хранилища, модули, «сломанные», прогноз', async p => p.evaluate(() => {
  const base = forecast('walk').mid;
  state.saveName = 'Спорт'; MODULES.find(m => m.id==='pace').store.set({ asked:true, n:3, walkK:1.3, boardK:1, exitK:1 });
  toggleMod('taxi'); toggleMod('coffee'); MODULES.find(m => m.id==='crowd').__broken = true; refreshModules();
  const slow = forecast('walk').mid; resetDemo();
  const d = MODULES.find(m => m.id==='pace').data(), mid = forecast('walk').mid;
  const ok = !state.templates.length && !state.recents.length && !state.saveName && !d.asked && d.walkK === 1
    && state.modules.taxi && !state.modules.coffee && !MODULES.find(m => m.id==='crowd').__broken && slow > base && mid === base;
  return ok || `base ${base} slow ${slow} after ${mid} taxi ${state.modules.taxi} coffee ${state.modules.coffee} asked ${d.asked}`;
}));
// ---------- этап P0: шлюз, копии, хранилище ----------
test('модуль меняет свой вариант позже, без пересчёта — на экран это не попадает (XSS)', async p => p.evaluate(() => {
  window.__x = 0; openPlace('baum'); go('compare');
  const o = MODULES.find(m => m.id==='walk').options.walk; const was = o.detail;
  o.detail = '<img src=x onerror="window.__x=1">'; render();
  return new Promise(r => setTimeout(() => { o.detail = was; r(window.__x === 0 && !document.body.innerHTML.includes('onerror') || 'код выполнился'); }, 200));
}));
test('ядро работает с замороженной копией варианта; значения по умолчанию — в копии', async p => p.evaluate(() => {
  const m = MODULES.find(x => x.id==='walk'), src = m.options.walk;
  const frozen = Object.isFrozen(OPTIONS.walk) && Object.isFrozen(OPTIONS.walk.legs[0]) && OPTIONS.walk !== src;
  return frozen || 'не заморожено';
}));
test('шлюз: нулевое время, не-текст, битый tail, шаг без подписи — вариант отброшен, без undefined/NaN', async p => p.evaluate(() => {
  const bad = { zero:{ name:'Ноль', purpose:'go', legs:[{ type:'walk', geom:'walkAll', lo:0, hi:0, label:'x' }] },
    numtxt:{ name:'Число', purpose:'go', price:5, legs:[{ type:'walk', geom:'walkAll', lo:1, hi:2, label:'x' }] },
    tail:{ name:'Хвост', purpose:'go', tail:[1, NaN], legs:[{ type:'walk', geom:'walkAll', lo:1, hi:2, label:'x' }] },
    nolabel:{ name:'Без подписи', purpose:'go', legs:[{ type:'walk', geom:'walkAll', lo:1, hi:2 }] } };
  const res = [];
  for(const [k, o] of Object.entries(bad)){
    registerModule({ id:'g' + k, group:'mode', icon:'?', name:'G', desc:'', where:'', on:true, options:{ [k]:o } });
    openPlace('baum'); go('compare'); res.push(!OPTIONS[k] && MODULES.find(m => m.id==='g' + k).__broken); unregisterModule('g' + k); }
  // вариант без detail и price — допустим, но без «undefined»
  registerModule({ id:'gmin', group:'mode', icon:'?', name:'G', desc:'', where:'', on:true, options:{ gmin:{ name:'Минимум', purpose:'go', legs:[{ type:'walk', geom:'walkAll', lo:5, hi:7, label:'пешком' }] } } });
  openPlace('baum'); go('compare'); const c = document.querySelector('.card[data-k=gmin]'); const txt = c ? c.innerText : '';
  unregisterModule('gmin');
  return (res.every(Boolean) && c && !/undefined|NaN/.test(txt)) || 'отброшены: ' + res.join(',') + ' · ' + txt;
}));
test('шаг для модуля — глубокая копия: модуль не портит станции маршрута', async p => p.evaluate(() => {
  const before = JSON.stringify(OPTIONS.metro.legs);
  registerModule({ id:'mut', icon:'?', name:'Порча', desc:'', where:'', on:true,
    stepHints(l){ try{ l.stations && l.stations.reverse(); l.parts && l.parts.push({ upto:99 }); }catch(e){} return []; } });
  openPlace('baum'); go('compare'); pick('metro'); go('route'); unregisterModule('mut');
  const src = MODULES.find(m => m.id==='metro').options.metro.legs.find(l => l.stations);
  return (JSON.stringify(OPTIONS.metro.legs) === before && src.stations[0] === 'Первомайская') || 'данные испорчены';
}));
test('способ без context() пересчитывается при смене времени', async p => p.evaluate(() => {
  registerModule({ id:'clock', group:'mode', icon:'?', name:'Часы', desc:'', where:'', on:true,
    options:{ clock:{ name:'По часам', purpose:'go', legs:[{ type:'walk', geom:'walkAll', lo:10, hi:12, label:'x' }] } },
    prepare(T){ const l = this.options.clock.legs[0]; l.lo = T > 12*60 ? 40 : 10; l.hi = l.lo + 2; } });
  openPlace('baum'); go('compare'); state.timeMode = 'depart'; state.depart = 8*60; render(); const a = forecast('clock').mid;
  state.depart = 14*60; render(); const b = forecast('clock').mid; unregisterModule('clock');
  return (a < 15 && b > 35) || `утро ${a} день ${b}`;
}));
test('битое хранилище «Мой темп» после перезагрузки — значения по умолчанию, прогноз не меняется', async p => {
  const base = await p.evaluate(() => forecast('walk').mid);
  const results = [];
  for(const bad of ['{"asked":true,"walkK":null,"n":1}', '{"walkK":"быстро","n":null}', '{"walkK":0.01,"boardK":50}', 'не json', '[1,2]']){
    await p.evaluate(v => localStorage.setItem('gis.mod.pace', v), bad); await p.reload(); await p.waitForTimeout(400);
    results.push(await p.evaluate(() => { const d = MODULES.find(m => m.id==='pace').data(); const s = MODULES.find(m => m.id==='pace').settings({}).rows.map(r => r[1]).join(' ');
      return [forecast('walk').mid, d.walkK, /NaN|null|undefined|−100/.test(s)]; })); }
  await p.evaluate(() => localStorage.clear());
  const ok = results.every(r => r[0] === base && r[1] === 1 && !r[2]);
  return ok || JSON.stringify(results) + ' base ' + base;
});
test('корректное хранилище «Мой темп» переживает перезагрузку', async p => {
  await p.evaluate(() => localStorage.setItem('gis.mod.pace', '{"asked":true,"n":2,"walkK":1.15,"boardK":1,"exitK":1}'));
  await p.reload(); await p.waitForTimeout(400);
  const k = await p.evaluate(() => MODULES.find(m => m.id==='pace').data().walkK); await p.evaluate(() => localStorage.clear());
  return k === 1.15 || 'walkK ' + k;
});
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
