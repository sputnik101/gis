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
  const on = forecast('walk').mid; setMod('slow'); const off = forecast('walk').mid; unregisterModule('slow');
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
  openPlace('baum'); go('compare'); setMod('taxi');
  const ok = !document.body.innerText.includes('Такси') && !OPTIONS.taxi && document.querySelectorAll('.card').length === 3;
  setMod('taxi'); return ok || 'карточек ' + document.querySelectorAll('.card').length;
}));
test('все способы выключены — понятное пустое состояние', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); ['metro','walk','taxi','carshare'].forEach(k => setMod(k));
  const ok = document.body.innerText.includes('Нет включённых способов') && !document.querySelectorAll('.card[data-k]').length;
  ['metro','walk','taxi','carshare'].forEach(k => setMod(k)); return ok || 'нет пустого состояния';
}));
test('без метро нет «метро + прогулки» и подсказки о загрузке вагонов', async p => p.evaluate(() => {
  setMod('metro'); walkNearby(); const noStroll = !OPTIONS.stroll && !document.body.innerText.includes('прогулка у Яузы');
  const noCrowd = !activeModules().some(m => m.id === 'crowd'); setMod('metro'); return (noStroll && noCrowd) || 'stroll/crowd остались';
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
  resetDemo(); state.templates.push({ name:'Работа', dest:'baum', arrive:540, mode:'metro' }); setMod('metro'); restart();
  const ok = document.body.innerText.includes('выключен'); setMod('metro'); return ok || 'нет пометки';
}));
test('«Вагон для выхода»: подсказка есть, выключил — пропала, без метро — не работает', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); pick('metro');
  const on = document.body.innerText.includes('Садись в первые вагоны');
  setMod('cars'); const off = !document.body.innerText.includes('Садись в первые вагоны'); setMod('cars');
  setMod('metro'); const dep = !activeModules().some(m => m.id==='cars'); setMod('metro');
  walkNearby(); pick('stroll'); const silent = !document.body.innerText.includes('Садись в');   // до Электрозаводской данных нет — молчит
  return (on && off && dep && silent) || JSON.stringify({on, off, dep, silent});
}));
test('такси выключили на маршруте — честно возвращаем к способам, без подмены', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); pick('taxi'); go('modules'); setMod('taxi'); back();
  const ok = state.view==='compare' && !document.body.innerText.includes('Такси до Бауманской'); setMod('taxi');
  back(); return (ok && state.view==='home') || 'view ' + state.view + ' hist ' + state.history;   // место открывается сразу способами — «назад» на главный
}));
test('такси выключили на подтверждении — к способам, «назад» один раз', async p => p.evaluate(() => {
  restart(); openPlace('baum'); go('compare'); pick('taxi'); go('confirm'); go('modules'); setMod('taxi'); back();
  const ok = state.view==='compare'; back(); setMod('taxi'); return (ok && state.view==='home') || 'view ' + state.view;
}));
test('способ пропал во время поездки — поездка идёт до конца на своей копии', async p => {
  await p.evaluate(() => { restart(); openPlace('baum'); go('compare'); pick('taxi'); return startTrip(true); });
  await p.waitForTimeout(300);
  return p.evaluate(() => { unregisterModule('taxi'); trip.t = 10; update(0); const mid = document.getElementById('gtop').innerText;
    const ok = /Такси|Подача|В пути/.test(mid) && !/NaN/.test(document.body.innerText); return ok || mid; });
});
test('«Пешком» выключили на маршруте прогулки — к способам', async p => p.evaluate(() => {
  restart(); walkNearby(); pick('stroll'); setMod('walk'); render();
  const ok = state.view==='compare'; setMod('walk'); return ok || 'view ' + state.view;
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
  setMod('walk'); restart(); const chip = !!document.querySelector('.wchip'); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render();
  const rain = document.body.innerText.includes('Дождь'); setMod('walk'); return (!chip && !rain) || JSON.stringify({chip, rain});
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
  return p.evaluate(() => { const offer = document.body.innerText.includes('Ездишь сюда регулярно?') && !document.body.innerText.includes('Что-то задержало?');
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Не сейчас').click();   // одна карточка за раз: сначала предложение сохранить
    const q = offer && document.body.innerText.includes('Что-то задержало?');
    document.querySelector('[data-c=wait]').click(); document.querySelector('[data-c=escal]').click();
    const two = state.modAns.pace.sel.length === 2; document.querySelector('[data-c=ok]').click(); const only = state.modAns.pace.sel.join() === 'ok';
    document.querySelector('[data-c=ok]').click(); document.querySelector('[data-c=wait]').click();
    const m0 = forecast('metro').mid; sendAns('pace'); const m1 = forecast('metro').mid;
    return (q && two && only && m1 > m0) || JSON.stringify({q, two, only, m0, m1}); });
});
test('«Мой темп» выключен — вопроса нет, прогноз общий; настройки и сброс работают', async p => {
  await tripDone(p, 'metro'); await p.evaluate(() => document.querySelector('[data-c=slow]').click());
  return p.evaluate(() => { openPlace('baum'); go('compare'); const tuned = forecast('walk').mid;
    setMod('pace'); const plain = forecast('walk').mid; setMod('pace');
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
  openPlace('baum'); go('compare'); setMod('roads');
  const ok = !OPTIONS.taxi && !OPTIONS.carshare && !!OPTIONS.metro && !!OPTIONS.walk; setMod('roads'); return ok || Object.keys(OPTIONS).join();
}));
// ---------- навигация ----------
test('место → поиск → место: сразу способы, «назад» — на главный, без цепочки старых мест', async p => p.evaluate(() => {
  restart(); openPlace('baum'); go('find'); openPlace('baum');
  const ok = state.view==='compare' && document.querySelector('h1').textContent.includes('Бауманская'); back();
  return (ok && state.view==='home') || 'view ' + state.view;
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
  resetDemo(); setDemoNow(500, 0); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render(); pick('metro');   // будний день: шаблон «пн–пт»
  go('save'); state.saveName='Работа'; saveTemplate(); saveReverse(false); restart();
  return (state.templates.length===1 && document.body.innerText.includes('выйди до')) || 'шаблонов ' + state.templates.length;
}));
test('сброс демо — чистый первый запуск: хранилища, модули, «сломанные», прогноз', async p => p.evaluate(() => {
  const base = forecast('walk').mid;
  state.saveName = 'Спорт'; MODULES.find(m => m.id==='pace').store.set({ asked:true, n:3, walkK:1.3, boardK:1, exitK:1 });
  setMod('taxi'); setMod('coffee'); MODULES.find(m => m.id==='crowd').__broken = true; refreshModules();
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

// ---------- этап P1: зависимости, время, поездка, сохранение — настоящими нажатиями ----------
const txt = p => p.evaluate(() => document.body.innerText);
const tap = async (p, sel) => { await p.click(sel, { timeout: 5000 }); await p.waitForTimeout(650); };
const tapText = async (p, t) => { await p.locator('button', { hasText: t }).first().click({ timeout: 5000 }); await p.waitForTimeout(650); };
test('«Пробки» на «Модулях»: предупреждение о такси и каршеринге, «Отмена» и «Выключить»', async p => {
  await p.evaluate(() => { openPlace('baum'); go('modules'); }); await p.waitForTimeout(650);
  await tapText(p, 'Служебные модули'); await tap(p, '.card[data-mod=roads]');
  const warn = (await txt(p)).includes('Без «Пробки» не будут работать «Такси» и «Каршеринг»');
  await tapText(p, 'Отмена'); const still = await p.evaluate(() => state.modules.roads);
  await tap(p, '.card[data-mod=roads]'); await tapText(p, 'Выключить'); const off = await p.evaluate(() => !state.modules.roads && state.modules.taxi);
  return (warn && still && off) || JSON.stringify({ warn, still, off });
});
test('способы без «Пробок»: подсказка «не работают без» и «Включить» возвращает такси', async p => {
  await p.evaluate(() => { setMod('roads', false); openPlace('baum'); go('compare'); }); await p.waitForTimeout(650);
  const hint = /Такси и Каршеринг — не работают без «Пробки»/.test(await txt(p));
  await p.locator('.hint .mlink', { hasText: 'Включить' }).click(); await p.waitForTimeout(300);
  const back = await p.evaluate(() => !!document.querySelector('.card[data-k=taxi]'));
  return (hint && back) || JSON.stringify({ hint, back });
});
test('пустое состояние: «Включить» включает способ вместе с тем, без чего он не работает', async p => {
  await p.evaluate(() => { ['metro','walk','taxi','carshare','roads'].forEach(k => setMod(k, false)); openPlace('baum'); go('compare'); }); await p.waitForTimeout(650);
  const label = (await txt(p)).includes('Включить «Такси» и «Пробки»');
  await tapText(p, 'Включить «Такси» и «Пробки»');
  const ok = await p.evaluate(() => !!document.querySelector('.card[data-k=taxi]'));
  return (label && ok) || JSON.stringify({ label, ok });
});
test('прогулки без «Пешком»: предложенная кнопка действительно даёт прогулку', async p => {
  await p.evaluate(() => { setMod('walk', false); walkNearby(); }); await p.waitForTimeout(650);
  await p.locator('.offer button.chip.on').first().click(); await p.waitForTimeout(300);
  const n = await p.evaluate(() => walkKeys().length);
  return n > 0 || 'прогулок нет';
});
test('метро в 0:30 открыто; в 0:50 — честно «закроется раньше, чем дойдёшь»; в 5:40 открыто', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); state.timeMode = 'depart';
  const at = t => { state.depart = t; render(); return verdict('metro'); };
  const a = at(1440 + 30), b = at(1440 + 50), c = at(1440 + 340);
  const card = document.querySelector('.card[data-k=metro]'); at(1440 + 50);
  const t50 = document.querySelector('.card[data-k=metro]').innerText;
  return (!a.closed && b.closed && b.word === 'закроется раньше' && !c.closed && /до 1:00/.test(t50)) || JSON.stringify({ a: a.word, b: b.word, c: c.word, t50 });
}));
test('двойной тап по «Завершить поездку» не обрывает её; подтверждение — отдельным нажатием', async p => {
  await p.evaluate(() => { openPlace('baum'); go('compare'); pick('walk'); return startTrip(true); }); await p.waitForTimeout(600);
  await p.dblclick('#stopBtn'); await p.waitForTimeout(200);
  const still = await p.evaluate(() => trip.on);
  await p.waitForTimeout(700); await p.click('#stopBtn'); await p.waitForTimeout(400);
  const ended = await p.evaluate(() => !trip.on);
  return (still && ended) || JSON.stringify({ still, ended });
});
test('первая поездка «к 9:00» — одна карточка (вопрос о темпе), без предложения сохранить', async p => {
  await p.evaluate(() => { restart(); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render(); pick('metro'); return startTrip(true); });
  await p.waitForTimeout(300); await p.evaluate(() => { trip.t = trip.total; }); await p.waitForTimeout(1200);
  const t = await txt(p);
  return (t.includes('Как ты обычно ходишь?') && !t.includes('Ездишь сюда регулярно?')) || 'карточки: ' + t.slice(0, 200);
});
test('шаблоны, недавние и модули переживают перезагрузку; битая запись не ломает запуск', async p => {
  await p.evaluate(() => { state.templates.push({ name:'Работа', dest:'baum', arrive:540, mode:'metro' }); state.recents = [{ to:'baum', from:null }]; setMod('coffee', true); });
  await p.reload(); await p.waitForTimeout(500);
  const kept = await p.evaluate(() => state.templates.length === 1 && state.templates[0].name === 'Работа' && state.recents[0].to === 'baum' && state.modules.coffee && document.body.innerText.includes('Работа'));
  await p.evaluate(() => localStorage.setItem('gis.app', '{"templates":[{"name":"<b>x</b>","dest":"nowhere","mode":5}],"modules":{"ghost":true,"taxi":"да"},"recents":"x"}'));
  await p.reload(); await p.waitForTimeout(500);
  const clean = await p.evaluate(() => !state.templates.length && !('ghost' in state.modules) && state.modules.taxi === true && Array.isArray(state.recents));
  await p.evaluate(() => localStorage.setItem('gis.app', 'не json')); await p.reload(); await p.waitForTimeout(500);
  const alive = await p.evaluate(() => state.view === 'home'); await p.evaluate(() => localStorage.clear());
  return (kept && clean && alive) || JSON.stringify({ kept, clean, alive });
});
test('после «Не спеша»: шаг «~N мин (обычно a–b)» с a ≤ N ≤ b, в шапке маршрута «по твоему темпу»', async p => {
  await tripDone(p, 'metro'); await p.evaluate(() => document.querySelector('[data-c=slow]').click());
  return p.evaluate(() => { openPlace('baum'); go('compare'); state.timeMode='depart'; state.depart = 9*60; render(); pick('walk'); go('route');
    const bad = [...document.querySelectorAll('.st .m')].map(e => e.textContent).filter(s => { const m = s.match(/~(\d+) мин \(обычно (\d+)–(\d+)\)/); return m && !(+m[2] <= +m[1] && +m[1] <= +m[3]); });
    const pill = /по твоему темпу/.test(document.querySelector('#body').innerText);
    return (!bad.length && pill) || JSON.stringify({ bad, pill }); });
});
test('выбранный ответ — тёмный чип с aria-pressed; неактивная кнопка — светлая, не «как активная»', async p => {
  await p.evaluate(() => { openPlace('baum'); go('compare'); pick('metro'); go('save'); }); await p.waitForTimeout(650);
  const dis = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Выбери название'); return b && b.disabled && getComputedStyle(b).backgroundColor; });
  await tapText(p, 'Работа');
  const sel = await p.evaluate(() => { const c = [...document.querySelectorAll('.chip')].find(x => x.textContent === 'Работа'); return c.getAttribute('aria-pressed') + ' ' + getComputedStyle(c).backgroundColor; });
  return (dis === 'rgb(228, 225, 243)' && sel === 'true rgb(26, 22, 64)') || JSON.stringify({ dis, sel });
});

// ---------- этап P2 ----------
test('второй шаблон к тому же месту другим способом — можно сохранить', async p => p.evaluate(() => {
  state.templates.push({ name:'Работа', dest:'baum', arrive:null, mode:'metro' }); openPlace('baum'); go('compare'); pick('taxi'); go('route');
  const can = !!document.querySelector('.savebtn'); go('compare'); pick('metro'); go('route'); const no = !document.querySelector('.savebtn');
  return (can && no) || JSON.stringify({ can, no });
}));
test('клавиатура: Enter в поиске открывает первое место, Escape — назад, «Сохранено» можно закрыть', async p => {
  await stubNet(p); await p.evaluate(() => go('find')); await p.waitForTimeout(650);
  await p.fill('#q', 'Бауманская улица'); await p.waitForTimeout(200); await p.press('#q', 'Enter'); await p.waitForTimeout(300); await p.press('#q', 'Enter'); await p.waitForTimeout(650);
  const place = await p.evaluate(() => state.view === 'compare' && state.dest === 'baum');
  await p.keyboard.press('Escape'); await p.waitForTimeout(650);
  const esc = await p.evaluate(() => state.view === 'home');
  await p.evaluate(() => openPlace('baum')); await p.waitForTimeout(650);
  await p.evaluate(() => { go('compare'); pick('metro'); go('save'); state.saveName = 'Работа'; saveTemplate(); }); await p.waitForTimeout(650);
  const hasBack = await p.evaluate(() => !!document.querySelector('#body .back-btn'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(650);
  const left = await p.evaluate(() => state.view !== 'save' && !state.justSaved);
  return (place && esc && hasBack && left) || JSON.stringify({ place, esc, hasBack, left });
});
test('модуль получает другой модуль только через this.use и только из requires', async p => p.evaluate(() => {
  let got = 'x', got2 = 'x';
  registerModule({ id:'peek', icon:'?', name:'P', desc:'', where:'', on:true, context(){ got = this.use('roads'); return {}; } });
  registerModule({ id:'peek2', requires:['roads'], icon:'?', name:'P2', desc:'', where:'', on:true, context(){ got2 = this.use('roads'); return {}; } });
  openPlace('baum'); go('compare'); unregisterModule('peek'); unregisterModule('peek2');
  return (got === null && got2 && typeof got2.at === 'function') || JSON.stringify({ got, got2: !!got2 });
}));
test('320 px: длинное слово без пробелов из модуля не вылезает за экран', async p => {
  await p.setViewportSize({ width: 320, height: 640 });
  return p.evaluate(() => { const W = 'Оченьдлинноесловобезпробеловкотороеможетприйтиизмодуля';
    registerModule({ id:'long', icon:'?', name:'L', desc:'', where:'', on:true, banners(){ return [{ title: W, text: W }]; }, cardPills(){ return [W]; }, stepHints(){ return [{ text: W }]; } });
    openPlace('baum'); go('compare'); snap('full'); const bad = [];
    const chk = v => document.querySelectorAll('#body *').forEach(e => { const r = e.getBoundingClientRect(); if(r.width && r.right > innerWidth + 1) bad.push(v + ':' + e.className); });
    chk('compare'); pick('metro'); go('route'); chk('route'); unregisterModule('long');
    return !bad.length || [...new Set(bad)].slice(0, 6).join(', '); });
});

test('место открывается сразу способами; «назад» — на главный, «Погулять рядом» снова видно', async p => {
  await p.evaluate(() => openPlace('baum')); await p.waitForTimeout(650);
  const noChip = await p.evaluate(() => state.view === 'compare' && !!state.sel && document.getElementById('topbar').classList.contains('hide'));
  await p.click('#body .back-btn'); await p.waitForTimeout(650);
  const ok = await p.evaluate(() => state.view === 'home' && !!document.querySelector('.wchip') && !!document.querySelector('.search .ph') && state.recents.some(r => r.to === 'baum'));
  return (noChip && ok) || JSON.stringify({ noChip, ok });
});

// ---------- добивка после проверки на испорченных копиях (25.11) ----------
test('лимиты шлюза: не больше 2 подсказок, 2 пилюль, 2 подсказок шага и 6 точек', async p => p.evaluate(() => {
  const many = n => Array.from({ length: n }, (_, i) => i);
  registerModule({ id:'spam', icon:'?', name:'S', desc:'', where:'', on:true,
    banners(){ return many(5).map(i => ({ title:'Б' + i })); }, cardPills(){ return many(5).map(i => 'П' + i); },
    stepHints(){ return many(5).map(i => ({ text:'Ш' + i })); }, pois(){ return many(10).map(i => ({ n:'Т' + i, at:[37.7 + i/1000, 55.78] })); } });
  openPlace('baum'); go('compare'); const n = [collect('banners').length, collect('cardPills','metro').length, collect('stepHints', legView('metro', OPTIONS.metro.legs[0]), 500).length, collect('pois','metro').length];
  unregisterModule('spam'); return n.join() === '2,2,2,6' || 'стало ' + n.join();
}));
test('множитель времени шага ограничен 0,5–3', async p => p.evaluate(() => {
  const base = forecast('walk').mid;
  registerModule({ id:'huge', icon:'?', name:'H', desc:'', where:'', on:true, legFactor(){ return 100; } }); const hi = forecast('walk').mid;
  unregisterModule('huge'); registerModule({ id:'tiny', icon:'?', name:'T', desc:'', where:'', on:true, legFactor(){ return 0.01; } }); const lo = forecast('walk').mid; unregisterModule('tiny');
  return (hi <= base * 3.1 && hi > base * 2 && lo >= base * 0.45 && lo < base * 0.7) || `base ${base} hi ${hi} lo ${lo}`;
}));
test('двойной тап по месту в недавних: способы открываются один раз', async p => {
  await p.evaluate(() => { openPlace('baum'); back(); }); await p.waitForTimeout(650);
  await p.locator('.lrow', { hasText: 'Бауманская' }).first().dblclick(); await p.waitForTimeout(650);
  return p.evaluate(() => (state.view === 'compare' && state.history.join() === 'home') || 'экран ' + state.view + ' ' + state.history);
});
test('после ночного выезда время в карточках — с «завтра»', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); state.timeMode = 'depart'; state.depart = 1440 + 50; render();
  return document.querySelector('.card[data-k=taxi]').innerText.includes('завтра') || 'нет «завтра»';
}));
test('«Загруженность вагонов»: утром в 8:20 у шага метро есть подсказка', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); pick('metro'); go('route'); return document.body.innerText.includes('вагоны полные') || 'нет подсказки';
}));
test('шлюз точек: без координат или имени — отброшено, правильная точка — есть', async p => p.evaluate(() => {
  registerModule({ id:'pp', icon:'?', name:'P', desc:'', where:'', on:true, pois(){ return [{ n:'Хорошая', at:[37.7, 55.78] }, { n:'Без места' }, { at:[37.7, 55.78] }, { n:'Кривая', at:['a', 1] }]; } });
  const r = collect('pois', 'walk').map(x => x.n); unregisterModule('pp');
  return r.join() === 'Хорошая' || 'точки: ' + r.join();
}));
test('XSS в подсказке шага и точке не исполняется', async p => p.evaluate(() => {
  window.__x = 0; const bad = '<img src=x onerror="window.__x=1">';
  registerModule({ id:'xs', icon:'?', name:'X', desc:'', where:'', on:true, stepHints(){ return [{ text: bad }]; }, pois(){ return [{ n: bad, d: bad, at:[37.7, 55.78] }]; } });
  openPlace('baum'); go('compare'); pick('walk'); go('route');
  return new Promise(r => setTimeout(() => { unregisterModule('xs'); r(window.__x === 0 || 'код выполнился'); }, 200));
}));
test('после поездки шторка и поиск снова доступны', async p => {
  await tripDone(p, 'walk'); await p.evaluate(() => restart()); await p.waitForTimeout(650);
  return p.evaluate(() => (!document.getElementById('sheet').inert && !document.getElementById('topbar').inert) || 'inert остался');
});
test('итог: такси к 9:00 — «риск», не «надёжно»; метро — «надёжно»', async p => p.evaluate(() => {
  openPlace('baum'); go('compare'); state.timeMode = 'arrive'; state.arrive = 540; render();
  return (verdict('taxi').cls === 'a' && verdict('metro').cls === 'g') || verdict('taxi').word + ' / ' + verdict('metro').word;
}));
test('выход из «Погулять рядом» назад возвращает обычный режим', async p => p.evaluate(() => {
  walkNearby(); back(); openPlace('baum'); go('compare'); return (state.mode === 'hurry' && !!document.querySelector('.card[data-k=metro]')) || 'режим ' + state.mode;
}));
test('модуль сообщил о новых данных (refreshModules) — прогноз пересчитан', async p => p.evaluate(() => {
  window.__slow = 1;
  registerModule({ id:'fact', icon:'?', name:'F', desc:'', where:'', on:true, context(){ return { k: window.__slow }; }, legFactor(l, f){ return l.type === 'walk' ? f.k : 1; } });
  openPlace('baum'); go('compare'); const a = forecast('walk').mid; window.__slow = 2; refreshModules(); const b = forecast('walk').mid; unregisterModule('fact');
  return b > a * 1.5 || `было ${a} стало ${b}`;
}));
test('смена времени пересчитывает способ без context() (другие факты не меняются)', async p => p.evaluate(() => {
  registerModule({ id:'clock2', group:'mode', icon:'?', name:'Часы', desc:'', where:'', on:true,
    options:{ clock2:{ name:'По часам', purpose:'go', legs:[{ type:'walk', geom:'walkAll', lo:10, hi:12, label:'x' }] } },
    prepare(T){ const l = this.options.clock2.legs[0]; l.lo = T > 15*60 ? 40 : 10; l.hi = l.lo + 2; } });
  openPlace('baum'); go('compare'); state.timeMode = 'depart'; state.depart = 14*60; render(); const a = forecast('clock2').mid;
  state.depart = 16*60; render(); const b = forecast('clock2').mid; unregisterModule('clock2');
  return (a < 15 && b > 35) || `14:00 ${a} 16:00 ${b}`;
}));
test('включить такси на «Модулях», когда «Пробки» выключены, — включаются оба', async p => {
  await p.evaluate(() => { setMod('roads', false); setMod('taxi', false); openPlace('baum'); go('modules'); }); await p.waitForTimeout(650);
  await p.click('.card[data-mod=taxi]'); await p.waitForTimeout(650);
  return p.evaluate(() => (state.modules.taxi && state.modules.roads) || JSON.stringify({ taxi: state.modules.taxi, roads: state.modules.roads }));
});
test('каршеринг — бронь только после подтверждения', async p => {
  await p.evaluate(() => { openPlace('baum'); go('compare'); pick('carshare'); go('route'); }); await p.waitForTimeout(650);
  await p.click('#goBtn'); await p.waitForTimeout(650);
  return p.evaluate(() => (state.view === 'confirm' && !trip.on) || 'экран ' + state.view + ' поездка ' + trip.on);
});

// ---------- шаблоны, фаза 2: дни недели и «Пора выходить» ----------
const saveWork = () => { setDemoNow(8*60+20, 2); openPlace('baum'); go('compare'); state.timeMode = 'arrive'; state.arrive = 540; render(); pick('metro'); go('save'); };
test('сохранение: у «Работы» сразу пн–пт, у «Спорта» дни не выбраны; дни можно поменять', async p => { await p.evaluate('window.saveWork = ' + saveWork); await p.evaluate(saveWork); return p.evaluate(() => {
  state.saveName = 'Спорт'; render(); const sport = saveDays().length === 0 && document.body.innerText.includes('в любой день');
  state.saveName = 'Работа'; render(); const work = saveDays().join() === '0,1,2,3,4';
  navLock = 0; [...document.querySelectorAll('.chips.days .chip')][5].click(); const sat = saveDays().includes(5);
  saveTemplate(); const t = state.templates[0];
  return (sport && work && sat && t.days.join() === '0,1,2,3,4,5') || JSON.stringify({ sport, work, sat, days: t.days });
}); });
test('«Пора выходить»: за 3 мин — «Через 3 мин выходить», «Маршрут» открывает маршрут метро', async p => { await p.evaluate('window.saveWork = ' + saveWork);
  await p.evaluate(() => { saveWork(); state.saveName = 'Работа'; saveTemplate(); saveReverse(false); restart(); });
  await p.evaluate(() => { setDemoNow(8*60+20, 2); restart(); }); await p.waitForTimeout(650);
  const t = await p.evaluate(() => (document.querySelector('.homecard') || {}).innerText || '');
  await p.locator('.homecard .mlink').click(); await p.waitForTimeout(650);
  const r = await p.evaluate(() => state.view === 'route' && state.sel === 'metro');
  return (/Через\s3\sмин выходить/.test(t) && /выйди до 8:23/.test(t) && r) || JSON.stringify({ t, r });
});
test('«Пора выходить»: в 8:23 — «Пора выходить», в 8:00 при 10 мин — нет, при 25 мин — есть; в субботу — нет, у шаблона «пн»', async p => { await p.evaluate('window.saveWork = ' + saveWork);
  await p.evaluate(() => { saveWork(); state.saveName = 'Работа'; saveTemplate(); saveReverse(false); });
  return p.evaluate(() => {
    const card = () => (document.querySelector('.homecard') || {}).innerText || '';
    setDemoNow(8*60+23, 2); restart(); const now = card();
    setDemoNow(8*60, 2); restart(); const early = card();
    go('modules'); openModSet('leave'); navLock = 0; [...document.querySelectorAll('.chip')].find(b => b.textContent.replace(/\s/g, ' ') === '25 мин').click(); restart(); const early25 = card();
    setDemoNow(8*60+20, 5); restart(); const sat = card(); const right = document.querySelector('.lrow .r').innerText;
    return (/^Пора выходить\n/.test(now) && !/впритык/.test(now) && !early && /Через\s23\sмин/.test(early25) && !sat && /пн/.test(right)) || JSON.stringify({ now, early, early25, sat, right });
  });
});
test('«Пора выходить» выключен — плашки нет; шаблоны и дни переживают перезагрузку', async p => { await p.evaluate('window.saveWork = ' + saveWork);
  await p.evaluate(() => { saveWork(); state.saveName = 'Работа'; saveTemplate(); saveReverse(false); setMod('leave', false); setDemoNow(8*60+20, 2); restart(); });
  const off = await p.evaluate(() => !document.querySelector('.homecard'));
  await p.reload(); await p.waitForTimeout(600);
  const kept = await p.evaluate(() => state.templates[0] && state.templates[0].days.join() === '0,1,2,3,4' && !state.modules.leave);
  await p.evaluate(() => localStorage.clear());
  return (off && kept) || JSON.stringify({ off, kept });
});
test('плашка главного от модуля — через шлюз: одна, текст не исполняется', async p => { await p.evaluate('window.saveWork = ' + saveWork); return p.evaluate(() => {
  window.__x = 0; saveWork(); state.saveName = 'Работа'; saveTemplate(); saveReverse(false); setMod('leave', false);
  registerModule({ id:'hc', icon:'?', name:'H', desc:'', where:'', on:true, homeCards(n){ return [{ title:'<img src=x onerror="window.__x=1">', text: n.name }, { title:'вторая' }]; } });
  restart(); const n = document.querySelectorAll('.homecard').length, txt = document.querySelector('.homecard').innerText;
  return new Promise(r => setTimeout(() => { unregisterModule('hc'); r((n === 1 && window.__x === 0 && /Работа/.test(txt)) || JSON.stringify({ n, x: window.__x, txt })); }, 200));
}); });
test('«Модули»: служебные («Пробки», «Мой темп») спрятаны, открываются по ссылке', async p => p.evaluate(() => {
  openPlace('baum'); go('modules'); const hidden = !document.querySelector('.card[data-mod=roads]') && !document.querySelector('.card[data-mod=pace]');
  navLock = 0; [...document.querySelectorAll('.mlink')].find(b => b.textContent.startsWith('Служебные модули')).click();
  const shown = !!document.querySelector('.card[data-mod=roads]') && !!document.querySelector('.card[data-mod=pace]');
  return (hidden && shown) || JSON.stringify({ hidden, shown });
}));

test('«Недавние»: «Очистить» убирает места, шаблоны остаются, после перезагрузки пусто', async p => {
  await p.evaluate(() => { state.recents = [{ to:'baum', from:null }]; state.templates.push({ name:'Работа', dest:'baum', arrive:540, mode:'metro', days:[] }); restart(); }); await p.waitForTimeout(650);
  await p.locator('button', { hasText: 'Очистить' }).click(); await p.waitForTimeout(650);
  const now = await p.evaluate(() => !state.recents.length && state.templates.length === 1 && ![...document.querySelectorAll('#body .sec')].some(e => e.textContent.startsWith('Недавние')));
  await p.reload(); await p.waitForTimeout(600); const after = await p.evaluate(() => !state.recents.length); await p.evaluate(() => localStorage.clear());
  return (now && after) || JSON.stringify({ now, after });
});

// ---------- замечания Сергея 25.11 ----------
test('пешком: «Пошли» и «Закончить путь», прогулка — «Закончить прогулку»; тост по способу', async p => {
  const a = await p.evaluate(() => { openPlace('baum'); go('compare'); pick('walk'); go('route'); return document.getElementById('goBtn').textContent; });
  await p.evaluate(() => startTrip(true)); await p.waitForTimeout(500);
  const stop = await p.evaluate(() => document.getElementById('stopBtn').textContent);
  await p.click('#stopBtn'); await p.waitForTimeout(700); await p.click('#stopBtn'); await p.waitForTimeout(600);
  const toastT = await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  await p.evaluate(() => { restart(); walkNearby(); pick('loop'); go('route'); return startTrip(true); }); await p.waitForTimeout(500);
  const stop2 = await p.evaluate(() => document.getElementById('stopBtn').textContent);
  return (a === 'Пошли' && stop === 'Закончить путь' && /Путь прерван/.test(toastT) && stop2 === 'Закончить прогулку') || JSON.stringify({ a, stop, toastT, stop2 });
});
test('«Кофе по пути» включён — кофейни есть и на маршруте «Пешком»', async p => p.evaluate(() => {
  setMod('coffee', true); openPlace('baum'); go('compare'); pick('walk'); go('route');
  const n = visiblePois('walk').filter(x => /Коф/.test(x.n)).length; const txt = document.body.innerText.includes('Кофе с собой');
  return (n === 2 && txt) || JSON.stringify({ n, txt });
}));
test('подпись карты не прилипает к «Погулять рядом» (зазор не меньше 12 px)', async p => p.evaluate(() => {
  restart(); const c = document.querySelector('.wchip').getBoundingClientRect(), a = document.getElementById('attrib').getBoundingClientRect();
  return (a.top - c.bottom >= 12) || 'зазор ' + Math.round(a.top - c.bottom);
}));

test('ориентиры поворотов: на маршруте — список, в пути — «Сейчас»/«Дальше», без метров', async p => {
  const route = await p.evaluate(() => { openPlace('baum'); go('compare'); pick('metro'); go('route'); return document.querySelector('.steps').innerText; });
  await p.evaluate(() => { back(); pick('walk'); return startTrip(true); }); await p.waitForTimeout(500);
  const g = []; for(const t of [0.3, 1.1, 23]){ await p.evaluate(t => { trip.t = t; }, t); await p.waitForTimeout(400); g.push(await p.evaluate(() => document.getElementById('gtop').innerText)); }
  const ok = /Налево у аптеки «Вита Экспресс» → Направо у цветочного/.test(route) && /Сейчас направо от подъезда/.test(g[0]) && /Сейчас налево у «Пятёрочки»/.test(g[1])
    && /Дальше налево у «Дежурной аптеки»/.test(g[2]) && !/Поворотов/.test(g.join()) && !/\d+\s?м\b/.test(g.join(' ').replace(/\d+\s?мин/g, ''));
  return ok || JSON.stringify({ route: route.slice(0, 120), g });
});

test('ориентир на карте: подпись появляется на подходе (300 м), рядом — подсвечена, после поездки убрана', async p => {
  await p.evaluate(() => { openPlace('baum'); go('compare'); pick('walk'); return startTrip(true); }); await p.waitForTimeout(400);
  // карта в проверках не грузится — подменяем маркер, чтобы проверить логику ядра
  return p.evaluate(() => new Promise(res => {
    const els = []; window.maplibregl = window.maplibregl || {}; const M = function(o){ this.el = o.element; els.push(this); }; M.prototype.setLngLat = function(a){ this.at = a; return this; }; M.prototype.addTo = function(){ return this; }; M.prototype.remove = function(){ this.gone = true; }; M.prototype.getElement = function(){ return this.el; };
    maplibregl.Marker = M; mapOk = true; window.map = window.map || {}; trip.markId = ''; trip.gkey = '';
    const at = t => { trip.t = t; trip.gkey = ''; guideHints(0, trip.o.legs[0], Math.min(1, t / trip.legs[0])); return trip.mark; };
    const far = at(trip.legs[0] * 0.05);            // ~490 м, до «Парикмахерской» далеко
    const s1 = !far;
    const near1 = at(trip.legs[0] * (1340 / 9809)); const t1 = near1 && near1.el.textContent, c1 = near1 && near1.el.classList.contains('near');
    const near2 = at(trip.legs[0] * (1390 / 9809)); const c2 = near2 && near2.el.classList.contains('near');
    mapOk = false; stopTrip(); const gone = !trip.mark;
    res((s1 && /То, что надо/.test(t1) && !c1 && c2 && gone) || JSON.stringify({ s1, t1, c1, c2, gone }));
  }));
});

test('домик «На главный» с глубоких экранов; где «назад» и так на главный — его нет', async p => {
  const r = await p.evaluate(() => { const has = () => !!document.querySelector('.home-btn');
    go('modules'); const fromHomeModules = has(); back();
    openPlace('baum'); go('compare'); const cmp = has(); pick('metro'); go('route'); const rt = has(); go('save'); const sv = has();
    return { fromHomeModules, cmp, rt, sv }; });
  await p.waitForTimeout(650); await p.click('.home-btn'); await p.waitForTimeout(650);
  const home = await p.evaluate(() => state.view === 'home' && !state.dest && !state.history.length && !!document.querySelector('.wchip'));
  return (!r.fromHomeModules && !r.cmp && r.rt && r.sv && home) || JSON.stringify({ r, home });   // способы открываются с главного — «назад» и так туда
});

test('поля ввода не мельче 16 px — Safari на iPhone не приближает страницу при вводе', async p => p.evaluate(() => {
  go('find'); const small = [...document.querySelectorAll('input,textarea,select')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.className);
  return !small.length || 'мелкие: ' + small.join();
}));

// ---------- живые маршруты (сеть подменена: поиск и пешие маршруты отвечают заглушками) ----------
const stubNet = p => p.evaluate(() => {
  const D = (a, b) => { const R=6371000, r=Math.PI/180, dLa=(b[1]-a[1])*r, dLo=(b[0]-a[0])*r; const x=Math.sin(dLa/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
  const PL = { 'парковая': [{ name:'13-я Парковая улица, 40', display_name:'40, 13-я Парковая улица, Северное Измайлово, Москва', lat:'55.808451', lon:'37.8126106' }],
    'милашенкова': [{ name:'улица Милашенкова, 4А к1', display_name:'4А к1, улица Милашенкова, Бутырский район, Москва', lat:'55.824654', lon:'37.5896941' }],
    'измайловская': [{ name:'Поликлиника №175', display_name:'Поликлиника №175, Измайлово, Москва', lat:'55.7882', lon:'37.7865' }] };
  window.__net = { fail:false, calls:[] };
  window.fetch = async url => { url = String(url); __net.calls.push(url);
    const ok = j => ({ ok:true, status:200, json: async () => j });
    if(url.includes('nominatim')){ const q = decodeURIComponent(url.split('q=')[1]).toLowerCase(); const k = Object.keys(PL).find(k => q.includes(k)); return ok(k ? PL[k] : []); }
    if(url.includes('routed-foot')){ if(__net.fail) throw new Error('offline');
      const pts = url.split('/foot/')[1].split('?')[0].split(';').map(s => s.split(',').map(Number));
      if(url.includes('/table/')) return ok({ code:'Ok', distances:[pts.map(p => D(pts[0], p) * 1.25)] });
      return ok({ code:'Ok', routes:[{ distance: D(pts[0], pts[1]) * 1.25, geometry:{ coordinates:[pts[0], pts[1]] } }] }); }
    throw new Error('нет сети в тестах'); };
});
const liveSetup = async (p, dest, fail) => { await stubNet(p); if(fail) await p.evaluate(() => { __net.fail = true; });
  await p.evaluate(async () => { startPickHome(); state.q = '13-я Парковая 40'; await doFind(); pickFound(0); });
  await p.waitForTimeout(700);
  return p.evaluate(async dest => { go('find'); state.q = dest; doFind.last = 0; await doFind(); pickFound(0);
    const k = state.dest; for(let i = 0; i < 80 && (state.locating || !liveRoute(k) || livePending(k)); i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 50)); return k; }, dest); };
test('живые: по умолчанию маршрут — от того места, где ты сейчас; без вопроса «Откуда» при первом запуске', async p => {
  await stubNet(p); await stubGeo(p, 37.8126106, 55.808451);
  const before = await p.evaluate(() => !document.body.innerText.includes('Откуда ты обычно выходишь'));
  const r = await p.evaluate(async () => { go('find'); state.q = 'Милашенкова 4А'; await doFind(); pickFound(0); const k = state.dest;
    for(let i = 0; i < 60 && (state.locating || !liveRoute(k)); i++) await new Promise(r => setTimeout(r, 50));
    return { from: originName(), first: OPTIONS.live && OPTIONS.live.legs[0].label, view: state.view, home: LIVE.home }; });
  return (before && r.from === 'Где я сейчас' && /Щёлковская/.test(r.first) && r.view === 'compare' && !r.home) || JSON.stringify(r); });
test('живые: Милашенкова — метро с двумя пересадками, только «Метро» и «Пешком», время ~1 ч', async p => {
  const k = await liveSetup(p, 'Милашенкова 4А');
  return p.evaluate(k => { go('compare'); const keys = goKeys(), o = OPTIONS.live;
    const tr = o ? o.legs.filter(l => l.model === 'transfer').map(l => l.label) : [];
    const rides = o ? o.legs.filter(l => l.type === 'metro').map(l => l.stations[0] + '→' + l.stations[l.stations.length-1]) : [];
    const mid = o ? forecast('live').mid : 0;
    return (keys.join() === 'live,livewalk' && tr.length === 2 && rides[0].startsWith('Щёлковская') && mid > 52 && mid < 75 && !/undefined|NaN/.test(document.body.innerText)) || JSON.stringify({ keys, tr, rides, mid }); }, k); });
test('живые: поликлиника рядом — без пересадок, около 25–35 мин; демо до Бауманской не задето', async p => {
  await liveSetup(p, 'Измайловская поликлиника');
  return p.evaluate(() => { go('compare'); const o = OPTIONS.live, mid = forecast('live').mid, tr = o.legs.filter(l => l.model === 'transfer').length;
    closePlace && closePlace(); openPlace('baum'); go('compare'); const demo = goKeys().join();
    return (tr === 0 && mid > 22 && mid < 36 && demo.includes('metro') && !demo.includes('live')) || JSON.stringify({ tr, mid, demo }); }); });
test('живые: пешие маршруты не загрузились — «время примерное», маршрут всё равно есть', async p => {
  const k = await liveSetup(p, 'Милашенкова 4А', true);
  return p.evaluate(() => { go('compare'); const t = document.body.innerText; return (!!OPTIONS.live && /время примерное/.test(t)) || t.slice(0, 300); }); });
test('живые: шаблон на работу переживает перезагрузку и считает «выйди до»', async p => {
  const k = await liveSetup(p, 'Милашенкова 4А');
  await p.evaluate(k => { state.templates.push({ name:'Работа', dest:k, arrive:10*60, mode:'live', reverse:false, days:[] }); saveApp(); }, k);
  await p.reload(); await p.waitForTimeout(800);
  return p.evaluate(() => { const t = document.body.innerText; return (/Работа/.test(t) && /выйди до|сейчас/i.test(t) && !tplNoRoute(state.templates[0])) || t.slice(0, 300); }); });
test('живые: на маршруте — шаги «Переход», линии в цвете, ведение стартует', async p => {
  await liveSetup(p, 'Милашенкова 4А');
  return p.evaluate(async () => { go('compare'); pick('live'); go('route'); const t = document.body.innerText;
    const ok = /Переход на/.test(t) && /Метро до Фонвизинская|Метро до/.test(t) && OPTIONS.live.legs.filter(l => l.colour).every(l => /^#/.test(l.colour));
    return ok || t.slice(0, 400); }); });

const stubGeo = (p, lon, lat) => p.evaluate(([lon, lat]) => { window.__geo = [lon, lat];
  const fix = () => ({ coords:{ longitude: window.__geo[0], latitude: window.__geo[1], accuracy:10 } });
  Object.defineProperty(navigator, 'geolocation', { configurable:true, value:{ getCurrentPosition(ok){ setTimeout(() => ok(fix()), 10); }, watchPosition(ok){ const id = setInterval(() => ok(fix()), 200); return id; }, clearWatch(id){ clearInterval(id); } } }); }, [lon, lat]);
test('живые: «Где я сейчас» — маршрут от текущей точки; шаблоны остаются от дома', async p => {
  const k = await liveSetup(p, 'Милашенкова 4А'); await stubGeo(p, 37.7799, 55.7877);   // у Измайловской
  return p.evaluate(async k => { LIVE.here = null; setFrom(null); for(let i = 0; i < 60 && (state.locating || !liveRoute(k)); i++) await new Promise(r => setTimeout(r, 50)); const first = OPTIONS.live && OPTIONS.live.legs[0].label;
    setFrom(homeFrom()); for(let i = 0; i < 60 && !liveRoute(k); i++) await new Promise(r => setTimeout(r, 50)); const home = OPTIONS.live.legs[0].label;
    return (state.dest === k && /Измайловская/.test(first) && /Щёлковская/.test(home)) || JSON.stringify({ first, home }); }, k); });
test('живые: «Где я сейчас» из другого города — честно «нет метро», кнопки «от дома» и «указать, откуда»', async p => {
  await liveSetup(p, 'Милашенкова 4А'); await stubGeo(p, 24.94, 60.17);   // Хельсинки
  return p.evaluate(async () => { const k = state.dest; LIVE.here = null; setFrom(null); for(let i = 0; i < 60 && (state.locating || !liveRoute(k)); i++) await new Promise(r => setTimeout(r, 50));
    const t = document.body.innerText; return (/далеко от Москвы/.test(t) && /Посчитать от дома/.test(t) && !OPTIONS.live) || t.slice(0, 300); }); });
test('живые: ведение по GPS — идём к метро, шаги сменяются сами, видно «успеваешь/впритык»', async p => {
  await liveSetup(p, 'Измайловская поликлиника'); await stubGeo(p, 37.8126106, 55.808451);
  const r = await p.evaluate(async () => { REAL_CLOCK = true; state.timeMode = 'arrive'; state.arrive = Math.floor(realNowMin()) + 60; SYNC_KEY = null;
    go('compare'); pick('live'); go('route'); await new Promise(r => setTimeout(r, 700)); await startTrip(); await new Promise(r => setTimeout(r, 1500));
    const a = { real: trip.real, li: trip.li, goal: document.getElementById('ggoal').textContent };
    const L = routeLegs[0]; window.__geo = L.c[L.c.length - 1];   // дошли до станции
    await new Promise(r => setTimeout(r, 1500)); a.li2 = trip.li; a.view = document.getElementById('gtop').innerText.slice(0, 60); stopTrip(); return a; });
  return (r.real && r.li === 0 && r.li2 >= 1 && /успеваешь/.test(r.goal)) || JSON.stringify(r); });

test('живые: в пути стало не успеть — «уже не успеть · опоздание», один раз вибрация', async p => {
  await liveSetup(p, 'Измайловская поликлиника'); await stubGeo(p, 37.8126106, 55.808451);
  const r = await p.evaluate(async () => { REAL_CLOCK = true; state.timeMode = 'arrive'; state.arrive = Math.floor(realNowMin()) + 40; SYNC_KEY = null;
    go('compare'); pick('live'); go('route'); await new Promise(r => setTimeout(r, 700)); await startTrip(); await new Promise(r => setTimeout(r, 1300));
    const g1 = document.getElementById('ggoal').textContent; let buzz = 0; navigator.vibrate = () => { buzz++; return true; };
    state.arrive = Math.floor(realNowMin()) + 10; await new Promise(r => setTimeout(r, 2300));
    const g2 = document.getElementById('ggoal').textContent; await new Promise(r => setTimeout(r, 1200)); stopTrip(); return { g1, g2, buzz }; });
  return (/успеваешь|впритык/.test(r.g1) && /не успеть/.test(r.g2) && r.buzz === 1) || JSON.stringify(r); });

test('живые: поиск «Метро измайловская» — одна станция с линией, без трёх одинаковых остановок', async p => {
  await stubNet(p);
  return p.evaluate(async () => { const f0 = window.fetch; window.fetch = async url => String(url).includes('nominatim')
      ? { ok:true, status:200, json: async () => [1,2,3].map(i => ({ name:'Метро «Измайловская»', type:'bus_stop', category:'highway', display_name:'Метро «Измайловская», Измайлово, Москва', lat: String(55.788 + i*0.0002), lon: String(37.779 + i*0.002), address:{ suburb:'район Измайлово', city:'Москва' } })) } : f0(url);
    go('find'); state.q = 'Метро измайловская'; await doFind(); const rows = [...document.querySelectorAll('#res .lrow')].map(b => b.innerText.replace(/\n/g, ' | '));
    return (rows.length === 1 && /м.\sИзмайловская/.test(rows[0]) && /Арбатско-Покровская/.test(rows[0])) || JSON.stringify(rows); }); });
test('живые: на экране способов — поля «Откуда» и «Куда», ⇅ меняет их местами', async p => {
  await liveSetup(p, 'Милашенкова 4А');
  return p.evaluate(async () => { const f = [...document.querySelectorAll('.fld')].map(b => b.innerText.replace(/\s+/g, ' '));
    const to0 = state.dest; swapFromTo(); for(let i = 0; i < 60 && (state.locating || !liveRoute(state.dest)); i++) await new Promise(r => setTimeout(r, 50));
    const f2 = [...document.querySelectorAll('.fld')].map(b => b.innerText.replace(/\s+/g, ' '));
    return (f.length === 2 && /Откуда/.test(f[0]) && /Куда.*Милашенкова/.test(f[1]) && state.dest !== to0 && /Милашенкова/.test(f2[0]) && !!OPTIONS.live) || JSON.stringify({ f, f2 }); }); });
test('живые: история — «откуда → куда», корзина удаляет одну строку; маршрут — свою', async p => {
  await liveSetup(p, 'Милашенкова 4А');
  return p.evaluate(async () => { go('find'); state.q = 'Измайловская поликлиника'; doFind.last = 0; await doFind(); pickFound(0);
    for(let i = 0; i < 60 && (state.locating || !liveRoute(state.dest)); i++) await new Promise(r => setTimeout(r, 50));
    state.templates.push({ name:'Работа', dest: state.recents[1].to, from: null, arrive:600, mode:'live', days:[] }, { name:'Зал', dest: state.recents[0].to, from: null, arrive:null, mode:'live', days:[] });
    goHome(); const n0 = document.querySelectorAll('.lrw').length, label = document.querySelector('.lrw .lrow .m').innerText;
    delRecent(0); const rec = state.recents.length; delTemplate(0);
    return (n0 === 4 && rec === 1 && state.templates.length === 1 && state.templates[0].name === 'Зал' && /→/.test(label)) || JSON.stringify({ n0, rec, t: state.templates.map(t => t.name), label }); }); });
test('блокер 1: путь не начинается и не кончается пересадкой (Зябликово ⇄ Красногвардейская), экран не пустой', async p => {
  await stubNet(p);
  await p.evaluate(async () => { LIVE.home = { name:'дом', at:[37.77, 55.57] }; saveLive(); });
  const r = await p.evaluate(async () => { addLivePlace('pq1', { name:'Запад', at:[37.35, 55.735] }); openPlace('pq1'); await LIVE.pending['pq1']; await new Promise(r => setTimeout(r, 50));
    const R = liveRoute('pq1'), segs = R && R.metro ? R.metro.segs : [];
    return { view: state.view, keys: goKeys(), first: segs[0] && !segs[0].transfer, last: segs.length && !segs[segs.length-1].transfer, cards: document.querySelectorAll('.card').length }; });
  return (r.view === 'compare' && r.keys.includes('live') && r.first && r.last && r.cards > 0) || JSON.stringify(r); });
test('блокер 1: перебор точек по Москве — ни один путь не начинается и не кончается пересадкой', async p => p.evaluate(() => {
  let bad = 0, n = 0;
  for(let la = 55.57; la <= 55.9; la += 0.03) for(let lo = 37.38; lo <= 37.85; lo += 0.04){ const A = [lo, la];
    const nA = nearStations(A), w = {}; nA.forEach(x => w[x.i] = x.d * 1.3 / 80);
    for(const B of [[37.62, 55.75], [37.45, 55.86], [37.8, 55.65]]){ const nB = nearStations(B), w2 = {}; nB.forEach(x => w2[x.i] = x.d * 1.3 / 80);
      const mp = metroPath(w, w2); n++; if(mp && (mp.segs[0].transfer || mp.segs[mp.segs.length-1].transfer)) bad++; } }
  return bad === 0 || `плохих ${bad} из ${n}`; }));
test('блокер 4: битый или старый маршрут в хранилище — отброшен, приложение открывается', async p => {
  await p.evaluate(() => { const sig = '37.81261,55.80845';
    localStorage.setItem('gis.live', JSON.stringify({ v:1, home:{ name:'дом', at:[37.81261, 55.80845] }, places:{ pabc:{ name:'Место', sub:'', at:[37.6, 55.75] }, pdef:{ name:'Другое', sub:'', at:[37.6, 55.76] } },
      routes:{ pabc:{ from:sig, v:METRO_VER, at:Date.now(), metro:{ segs:[] } }, pdef:{ from:sig, v:'старая', at:Date.now(), walk:{ m:100, coords:[[37.6,55.76],[37.61,55.76]] } } } }));
    localStorage.setItem('gis.app', JSON.stringify({ v:1, templates:[{ name:'Работа', dest:'pabc', arrive:540, mode:'live', days:[] }], recents:['pabc'], visits:{}, declined:{}, modules:{} })); });
  await p.reload(); await p.waitForTimeout(800);
  return p.evaluate(() => ((!LIVE.routes.pabc || (routeOk(LIVE.routes.pabc) && LIVE.routes.pabc.metro.segs.length)) && !LIVE.routes.pdef && /Работа/.test(document.body.innerText)) || JSON.stringify(Object.keys(LIVE.routes))); });   // битый отброшен; шаблон мог пересчитать маршрут заново
test('блокер 3: «Где я сейчас» остался включённым — шаблон считает от дома, без бесконечных запросов', async p => {
  const k = await liveSetup(p, 'Милашенкова 4А'); await stubGeo(p, 37.7799, 55.7877);
  return p.evaluate(async k => { LIVE.here = null; setFrom(null); for(let i = 0; i < 60 && state.locating; i++) await new Promise(r => setTimeout(r, 50)); goHome(); for(const key in LIVE.routes) delete LIVE.routes[key];
    state.templates.push({ name:'Работа', dest:k, arrive:600, mode:'live', reverse:false, days:[] });
    const n0 = __net.calls.length; useTemplate(state.templates.length - 1); await new Promise(r => setTimeout(r, 800));
    const calls = __net.calls.length - n0, first = OPTIONS.live && OPTIONS.live.legs[0].label;
    return (calls < 10 && state.view === 'route' && /Щёлковская/.test(first) && state.from && state.from.home) || JSON.stringify({ calls, view: state.view, first, from: state.from }); }, k); });
test('блокер 2: вечером «Прибыть к 9:00» — это завтра, «Выйти в 8:30» не превращается в «сейчас»', async p => p.evaluate(() => {
  setDemoNow(21*60, 2); openPlace('baum'); go('time'); setTimeMode('arrive'); chipTime(540); applyTime();
  const arr = state.arrive, v = verdict(goKeys()[0]).cls; go('time'); setTimeMode('depart'); chipTime(510); applyTime();
  return (arr === 540 + 1440 && v !== 'r' && state.depart === 510 + 1440) || JSON.stringify({ arr, v, dep: state.depart }); }));
test('блокер 2: полночь — «завтра 0:30» становится «сегодня 0:30»; шаблон вечером показывает следующий раз', async p => p.evaluate(() => {
  setDemoNow(23*60 + 50, 2); state.timeMode = 'arrive'; state.arrive = normDay(30); const before = state.arrive; clockTick(5);
  const after = state.arrive; state.templates = [{ name:'Работа', dest:'baum', arrive:540, mode:'metro', reverse:false, days:[] }]; setDemoNow(21*60, 2); restart();
  const card = document.body.innerText;
  return (before === 1470 && after === 30 && /к 9:00\s*завтра/.test(card)) || JSON.stringify({ before, after, card: card.slice(0, 200) }); }));

test('из места по истории и назад — на главном снова «Погулять рядом», места нет', async p => {
  await liveSetup(p, 'Милашенкова 4А');
  await p.evaluate(() => { goHome(); openRecent(0); }); await p.waitForTimeout(700);
  await p.click('#body .back-btn'); await p.waitForTimeout(700);
  return p.evaluate(() => (state.view === 'home' && !state.dest && !document.getElementById('topbar').classList.contains('hide') && !!document.querySelector('#topbar .wchip')) || JSON.stringify({ v: state.view, d: state.dest })); });

test('пешком — всегда, даже дальше трёх часов; повороты с ориентирами, без метров', async p => {
  await stubNet(p);
  await p.evaluate(() => { const f0 = window.fetch;
    window.fetch = async (url, opt) => { url = String(url);
      const ok = j => ({ ok:true, status:200, text: async () => JSON.stringify(j), json: async () => j });
      if(url.includes('/route/v1/foot/')){ const pts = url.split('/foot/')[1].split('?')[0].split(';').map(s => s.split(',').map(Number));
        return ok({ code:'Ok', routes:[{ distance: 16000, geometry:{ coordinates: pts }, legs:[{ steps:[
          { distance: 300, name:'', maneuver:{ type:'depart', location: pts[0] } },
          { distance: 5000, name:'Сиреневый бульвар', maneuver:{ type:'turn', modifier:'left', location:[37.80, 55.80] } },
          { distance: 10700, name:'Измайловский проспект', maneuver:{ type:'turn', modifier:'right', location:[37.78, 55.79] } },
          { distance: 0, name:'', maneuver:{ type:'arrive', location: pts[1] } } ] }] }] }); }
      if(url.includes('overpass') || url.includes('interpreter')) return ok({ elements:[{ type:'node', lat:55.8001, lon:37.8001, tags:{ name:'Вита Экспресс', amenity:'pharmacy' } }] });
      return f0(url, opt); }; });
  await p.evaluate(async () => { LIVE.home = { name:'дом', at:[37.8126, 55.8084] }; addLivePlace('pfar', { name:'Далеко', at:[37.45, 55.86] }); openPlace('pfar', homeFrom());
    for(let i = 0; i < 80 && !liveRoute('pfar'); i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 400)); });
  return p.evaluate(() => { go('compare'); const keys = goKeys(), w = OPTIONS.livewalk, t = w && w.legs[0].turns;
    pick('livewalk'); go('route'); const txt = document.body.innerText;
    return (keys.includes('livewalk') && /больше трёх часов/.test(w.detail) && t.length === 2 && /у аптеки «Вита Экспресс»/.test(t[0][2]) && /Направо на Измайловский проспект/.test(txt) && !/\d+\s*м\b/.test(t.map(x => x[2]).join(' ')))
      || JSON.stringify({ keys, detail: w && w.detail, t, txt: txt.slice(0, 300) }); }); });

test('«Погулять рядом» — от того места, где ты сейчас: кольца 20/40/60 мин через парк, «По пути» — парк', async p => {
  await p.goto(p.url().replace('?demo', '')); await p.waitForTimeout(600);
  await stubGeo(p, 37.8126106, 55.808451);
  await p.evaluate(() => { const D = (a, b) => { const R=6371000, r=Math.PI/180, dLa=(b[1]-a[1])*r, dLo=(b[0]-a[0])*r; const x=Math.sin(dLa/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
    window.fetch = async (url) => { url = String(url); const ok = j => ({ ok:true, status:200, text: async () => JSON.stringify(j), json: async () => j });
      if(url.includes('interpreter')) return ok({ elements:[{ type:'way', center:{ lat:55.795, lon:37.82 }, tags:{ name:'Измайловский парк', leisure:'park' } }] });
      if(url.includes('/route/v1/foot/')){ const pts = url.split('/foot/')[1].split('?')[0].split(';').map(s => s.split(',').map(Number)); let d = 0; for(let i = 1; i < pts.length; i++) d += D(pts[i-1], pts[i]) * 1.3;
        return ok({ code:'Ok', routes:[{ distance: d, geometry:{ coordinates: pts }, legs: pts.slice(1).map(() => ({ steps:[] })) }] }); }
      throw new Error('нет сети'); }; });
  const r = await p.evaluate(async () => { setDemoNow(14*60, 4); REAL_CLOCK = false; walkNearby(); for(let i = 0; i < 80 && (state.locating || LIVE.loopsPending || !LIVE.loops); i++) await new Promise(r => setTimeout(r, 50)); render();
    const keys = walkKeys(), mins = keys.map(k => Math.round(OPTIONS[k].legs[0].len / 70));
    return { keys, mins, detail: OPTIONS[keys[2]] && OPTIONS[keys[2]].detail, pois: (OPTIONS[keys[2]] || {}).pois, txt: document.body.innerText.slice(0, 300), from: originName() }; });
  const okMins = r.mins.length === 3 && r.mins.every((m, i) => Math.abs(m - [20, 40, 60][i]) <= [20, 40, 60][i] * 0.3);
  return (r.keys.join() === 'stroll20,stroll40,stroll60' && okMins && /Измайловский парк/.test(r.detail + JSON.stringify(r.pois)) && r.from === 'Где я сейчас' && !/Дождь/.test(r.txt)) || JSON.stringify(r); });

test('Прогулка без Overpass: парки из встроенного списка, у большого парка цель — край, а не центр', async p => {
  await p.goto(p.url().replace('?demo', '')); await p.waitForTimeout(600);
  await stubGeo(p, 37.7416, 55.7904);   // Семёновская: рядом Измайловский парк и Семёновский
  await p.evaluate(() => { let hits = 0; window._ovp = () => hits;
    window.fetch = async (url) => { url = String(url); const ok = j => ({ ok:true, status:200, text: async () => JSON.stringify(j), json: async () => j });
      if(url.includes('interpreter')){ hits++; throw new Error('502'); }
      if(url.includes('/route/v1/foot/')){ const pts = url.split('/foot/')[1].split('?')[0].split(';').map(s => s.split(',').map(Number)); let d = 0; for(let i = 1; i < pts.length; i++) d += dist(pts[i-1], pts[i]) * 1.3;
        return ok({ code:'Ok', routes:[{ distance: d, geometry:{ coordinates: pts }, legs: pts.slice(1).map(() => ({ steps:[] })) }] }); }
      throw new Error('нет сети'); }; });
  const r = await p.evaluate(async () => { setDemoNow(14*60, 4); REAL_CLOCK = false; walkNearby(); for(let i = 0; i < 80 && (state.locating || LIVE.loopsPending || !LIVE.loops); i++) await new Promise(r => setTimeout(r, 50));
    const o = [37.7416, 55.7904], iz = greenLocal(o, 2500).find(g => g.n === 'Измайловский парк');
    const k = walkKeys(); return { n: GREEN.length, k, det: k.map(x => OPTIONS[x].detail), ovp: _ovp(), edge: iz && Math.round(dist(o, iz.at)), centre: iz && Math.round(dist(o, iz.c)) }; });
  return (r.n > 500 && r.k.length === 3 && r.det.some(d => /через .*(парк|сквер|пруд|роща|лес)/i.test(d)) && r.ovp === 0 && r.edge < r.centre) || JSON.stringify(r); });

test('Версия приложения видна внизу «Модулей»', async p => {
  const r = await p.evaluate(() => { go('modules'); return document.body.innerText; });
  return (/Версия \d+\.\d+/.test(r) && r.includes('Версия ' + (await p.evaluate(() => APP_VERSION)))) || r.slice(-300); });

test('ориентиры у поворотов — из своей карты (map/tiles), Overpass не нужен', async p => {
  const fs = require('fs'), pt = [37.65892, 55.75862], n = 2 ** 14, tiles = {};
  for(const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const lon = pt[0] + dx * 0.0006, lat = pt[1] + dy * 0.0004, r = lat * Math.PI / 180;
    const k = Math.floor((lon + 180) / 360 * n) + '/' + Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
    const f = '/tmp/site/map/tiles/14/' + k + '.pbf'; if(fs.existsSync(f)) tiles[k] = fs.readFileSync(f).toString('base64'); }
  const r = await p.evaluate(async ([tiles, pt]) => { let ovp = 0; const f0 = window.fetch;
    window.fetch = async (url, o) => { url = String(url); if(url.endsWith('map/style.json')) return { ok:true, status:200 }; const m = url.match(/map\/tiles\/14\/(\d+\/\d+)\.pbf/);
      if(m){ const b = tiles[m[1]]; if(!b) return { ok:false, status:404 }; const bin = Uint8Array.from(atob(b), c => c.charCodeAt(0)); return { ok:true, status:200, arrayBuffer: async () => bin.buffer }; }
      if(url.includes('interpreter')){ ovp++; throw new Error('502'); } return f0(url, o); };
    const turns = [[120, 'направо', 'на Покровку', pt, 'Покровка'], [300, 'налево', 'по дорожке', [37.70, 55.70], 'налево']];
    OWN_MAP = null; const ok = await addLandmarks(turns); window.fetch = f0; OWN_MAP = null; return { ok, t0: turns[0][2], t1: turns[1][2], ovp }; }, [tiles, pt]);
  return (r.ok && /^у .*«.+», на Покровка$/.test(r.t0) && r.t1 === 'по дорожке' && r.ovp === 0) || JSON.stringify(r); });

test('до выхода больше часа — без фальшивого «Напомнить»: «Выходить в …» и демо-проигрыш', async p => p.evaluate(() => {
  resetDemo(); setDemoNow(6*60, 0); openPlace('baum'); go('compare'); state.timeMode='arrive'; state.arrive=540; render(); pick('metro'); go('route');
  const txt = document.body.innerText, btn = document.getElementById('goBtn');
  return (!/Напомн/.test(txt) && /Выходить в \d/.test(txt) && btn && /Демо: проиграть/.test(btn.textContent) && typeof window.remind === 'undefined') || txt.slice(0, 400);
}));

test('обычный режим (без ?demo): ни демо-мест в поиске, ни неготовых модулей — они строкой «Скоро»', async p => {
  await p.goto(p.url().replace('?demo', '')); await p.waitForTimeout(600);
  return p.evaluate(() => { go('find'); state.q = 'бау'; render(); const find = document.body.innerText;
    go('modules'); const mods = document.body.innerText, act = activeModules().map(m => m.id);
    const ok = !/Демо-маршрут|МГТУ/.test(find) && /Скоро: такси, каршеринг/.test(mods) && !/\nДемо\n|Демо: начать/.test(mods) && !/\nТакси\n/.test(mods)
      && act.every(id => ['metro','walk','live','pace','leave'].includes(id)) && /Версия \d/.test(mods);
    return ok || JSON.stringify({ act, mods: mods.slice(-500) }); }); });

test('журнал поездок: настоящая поездка записывается, «Мои поездки» на главном, темп пешком подстраивается с трёх поездок', async p => {
  const one = () => p.evaluate(async () => { restart(); openPlace('baum'); go('compare'); pick('walk'); await startTrip(true);
    const o = trip.o, L = trip.legs; trip.real = true; let t = 0; trip.legAt = L.map(m => { const s = t; t += m * (o.legs[trip.legAt.length] && o.legs[0].type === 'walk' ? 1.2 : 1.2); return s; });
    trip.t0 = Date.now() - t * 60000; finish(); return { done: document.body.innerText, n: TRIPS.length }; });
  await p.evaluate(() => { resetDemo(); TRIPS = []; saveTrips(); });
  const a = await one();
  const home1 = await p.evaluate(() => { restart(); return document.body.innerText; });
  await one(); await one();
  const r = await p.evaluate(() => { restart(); const home = document.body.innerText; go('trips'); const list = document.body.innerText;
    return { home, list, wk: paceMod().data().walkK, n: TRIPS.length, saved: JSON.parse(localStorage.getItem('gis.trips')).length }; });
  const ok = /Прогноз — \d+\sмин, вышло \d+\sмин/.test(a.done) && /Мои поездки/.test(home1) && /с трёх прогноз/.test(home1)
    && r.n === 3 && r.saved === 3 && /на 20% дольше/.test(r.home) && /прогноз \d+, вышло \d+\sмин/.test(r.list) && r.wk >= 1.15 && r.wk <= 1.25;
  return ok || JSON.stringify({ done: a.done.slice(0, 300), home1: home1.slice(0, 300), r: Object.assign(r, { home: r.home.slice(0, 400), list: r.list.slice(0, 500) }) }); });

test('живая прогулка ведётся по GPS (не демо-проигрыш) и не «кончается» у старта кольца', async p => {
  await p.goto(p.url().replace('?demo', '')); await p.waitForTimeout(600);
  await stubGeo(p, 37.6384, 55.7652);
  await p.evaluate(() => { window.fetch = async () => { throw new Error('нет сети'); }; });
  const r = await p.evaluate(async () => { walkNearby(); for(let i = 0; i < 100 && (state.locating || LIVE.loopsPending || !LIVE.loops); i++) await new Promise(r => setTimeout(r, 50));
    pick(walkKeys()[0]); await startTrip(); await new Promise(r => setTimeout(r, 1500));
    return { real: trip.real, on: trip.on, speed: document.getElementById('speedBtn').hidden, view: state.view }; });
  return (r.real && r.on && r.speed && r.view === 'route') || JSON.stringify(r); });

test('прогулка начинается там, где ты сейчас: отошёл после «Погулять рядом» — кольцо перестраивается от тебя', async p => {
  await p.goto(p.url().replace('?demo', '')); await p.waitForTimeout(600);
  await stubGeo(p, 37.6384, 55.7652);
  await p.evaluate(() => { window.fetch = async () => { throw new Error('нет сети'); }; });
  const r = await p.evaluate(async () => { walkNearby(); for(let i = 0; i < 100 && (state.locating || LIVE.loopsPending || !LIVE.loops); i++) await new Promise(r => setTimeout(r, 50));
    const k = walkKeys()[1], start0 = OPTIONS[k].legs[0].coords[0]; pick(k);
    window.__geo = [37.6420, 55.7660];   // отошёл ~250 м
    await startTrip(); await new Promise(r => setTimeout(r, 1200));
    const s1 = trip.o.legs[0].coords[0];
    return { real: trip.real, moved: Math.round(dist(start0, [37.6420, 55.7660])), startNow: Math.round(dist(s1, [37.6420, 55.7660])), min: trip.o.name }; });
  return (r.real && r.moved > 200 && r.startNow < 15 && /40/.test(r.min)) || JSON.stringify(r); });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let fail = 0;
  for(const t of T.filter(t => !process.env.ONLY || t.name.includes(process.env.ONLY))){
    const p = await b.newPage({ viewport: { width: 430, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(file + '?demo'); await p.waitForTimeout(600);
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
