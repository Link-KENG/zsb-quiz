/* 智盛杯训练题在线答题：完整训练500题 + 随机模拟卷100题（即答即判 + 总分/用时秒数） */
(function () {
  'use strict';

  var DATA = window.QDATA.blocks;
  var FLAT = [];
  DATA.forEach(function (blk, bi) {
    blk.forEach(function (q, i) {
      FLAT.push({ q: q, no: bi * 100 + i + 1, block: bi });
    });
  });
  var TOTAL_FULL = FLAT.length; // 500
  var TYPE_LABEL = { single: '单选题', multi: '多选题', judge: '判断题' };
  var TYPE_CLS = { single: 'single', multi: 'multi', judge: 'judge' };
  var KEY_FULL = 'zsb500_full_v2';
  var KEY_MOCK = 'zsb500_mock_v2';
  var KEY_HISTORY = 'zsb500_history_v1';

  function decode(ans64) {
    var bin = atob(ans64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function correctOf(q) { return decode(q.ans64); }

  var state = null; // { name, mode, paper:[flatIdx...], answers, locked, startAt, submitted, idx }

  var $ = function (id) { return document.getElementById(id); };
  var timerInt = null;

  /* ---------- 模拟卷抽题 ---------- */
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function genMockPaper() {
    var singles = [], multis = [], judges = [];
    FLAT.forEach(function (it, i) {
      if (it.q.t === 'single') singles.push(i);
      else if (it.q.t === 'multi') multis.push(i);
      else judges.push(i);
    });
    shuffleArr(singles); shuffleArr(multis); shuffleArr(judges);
    return shuffleArr(singles.slice(0, 50).concat(multis.slice(0, 30), judges.slice(0, 20)));
  }
  function newState(mode, paper) {
    return {
      name: '', mode: mode, paper: paper,
      answers: new Array(paper.length).fill(null),
      locked: new Array(paper.length).fill(false),
      startAt: null, submitted: false, idx: 0
    };
  }

  /* ---------- 存取 ---------- */
  function storeKey() { return state.mode === 'mock' ? KEY_MOCK : KEY_FULL; }
  function save() {
    try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) {}
  }
  function loadKey(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s.paper || !s.answers || s.answers.length !== s.paper.length) return null;
      if (!s.locked || s.locked.length !== s.paper.length) {
        s.locked = new Array(s.paper.length).fill(false);
      }
      return s;
    } catch (e) { return null; }
  }
  function clearStores() {
    try { localStorage.removeItem(KEY_FULL); localStorage.removeItem(KEY_MOCK); } catch (e) {}
  }

  /* ---------- 历史记录 ---------- */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(KEY_HISTORY)) || []; } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(list)); } catch (e) {}
  }
  function clearHistory() {
    try { localStorage.removeItem(KEY_HISTORY); } catch (e) {}
  }
  function addRecord() {
    var r = compute();
    var rec = {
      ts: Date.now(), name: state.name, mode: state.mode,
      paper: state.mode === 'full' ? null : state.paper,
      answers: state.answers, locked: state.locked,
      score: r.right, total: r.total,
      secs: Math.round((Date.now() - state.startAt) / 1000)
    };
    var list = loadHistory();
    list.unshift(rec);
    if (list.length > 30) list.length = 30;
    saveHistory(list);
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- 判分 ---------- */
  function isCorrect(q, u) {
    if (u == null) return false;
    var c = correctOf(q);
    if (q.t === 'multi') {
      if (!Array.isArray(u) || u.length === 0) return false;
      return u.slice().sort().join('') === c.split('').sort().join('');
    }
    return u === c;
  }

  function compute() {
    var perType = { single: { n: 0, s: 0 }, multi: { n: 0, s: 0 }, judge: { n: 0, s: 0 } };
    var perBlock = DATA.map(function () { return { n: 0, s: 0 }; });
    var right = 0, unanswered = 0;
    state.paper.forEach(function (fi, pos) {
      var q = FLAT[fi].q;
      var u = state.answers[pos];
      var lk = state.locked[pos];
      var ok = lk && isCorrect(q, u);
      if (!lk) unanswered++;
      else if (ok) right++;
      perType[q.t].n++;
      if (ok) perType[q.t].s++;
      perBlock[FLAT[fi].block].n++;
      if (ok) perBlock[FLAT[fi].block].s++;
    });
    return { right: right, unanswered: unanswered, total: state.paper.length, perType: perType, perBlock: perBlock };
  }

  /* ---------- 开始页 ---------- */
  function showStart() {
    $('start').classList.remove('hidden');
    $('exam').classList.add('hidden');
    $('result').classList.add('hidden');
    $('nameInput').value = state ? state.name : '';
    var savedMock = loadKey(KEY_MOCK);
    $('resumeMockBtn').classList.toggle('hidden', !(savedMock && !savedMock.submitted));
    renderHistory();
  }

  function renderHistory() {
    var list = loadHistory();
    var box = $('historyBox');
    if (!list.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    var html = '<div class="historyTitle">历史答题记录（共 ' + list.length + ' 次）<button id="clearHistoryBtn">清空记录</button></div>';
    list.forEach(function (rec, i) {
      var modeLabel = rec.mode === 'mock' ? '随机模拟卷' : '完整训练';
      html += '<div class="historyItem" data-i="' + i + '">' +
        '<span class="hNo">#' + (i + 1) + '</span>' +
        '<span class="hMain">' + (rec.name || '匿名') + ' · ' + modeLabel +
        ' <b>' + rec.score + ' / ' + rec.total + '</b> 分 · ' + rec.secs + ' 秒</span>' +
        '<span class="hTime">' + fmtDate(rec.ts) + '</span></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.historyItem').forEach(function (el) {
      el.onclick = function () { viewRecord(list[Number(el.dataset.i)]); };
    });
    $('clearHistoryBtn').onclick = function () {
      if (confirm('确定清空全部历史记录吗？')) { clearHistory(); renderHistory(); }
    };
  }

  function viewRecord(rec) {
    state = {
      name: rec.name, mode: rec.mode,
      paper: rec.paper || FLAT.map(function (_, i) { return i; }),
      answers: rec.answers, locked: rec.locked,
      startAt: 0, submitted: true, idx: 0,
      secsOverride: rec.secs, ts: rec.ts, historyView: true
    };
    showResult();
  }

  /* ---------- 答题页 ---------- */
  function showExam() {
    $('start').classList.add('hidden');
    $('exam').classList.remove('hidden');
    $('result').classList.add('hidden');
    if (!state.startAt) state.startAt = Date.now();
    renderTabs();
    renderInfo();
    renderCard();
    renderGrid();
    startTimer();
    save();
  }

  function renderTabs() {
    var html = '';
    if (state.mode === 'full') {
      for (var b = 0; b < 5; b++) {
        html += '<button class="tab' + (blockOf() === b ? ' active' : '') + '" data-block="' + b + '">第' + (b + 1) + '组</button>';
      }
    } else {
      html = '<span class="tab active">随机模拟卷</span>';
    }
    $('tabs').innerHTML = html;
    $('tabs').querySelectorAll('.tab[data-block]').forEach(function (btn) {
      btn.onclick = function () {
        state.idx = Number(btn.dataset.block) * 100;
        renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
      };
    });
  }

  function renderInfo() {
    $('counter').textContent = '第 ' + (state.idx + 1) + ' / ' + state.paper.length + ' 题';
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function startTimer() {
    if (timerInt) clearInterval(timerInt);
    $('timer').textContent = '用时 ' + fmtTime(Date.now() - state.startAt);
    timerInt = setInterval(function () {
      if (state.submitted) { clearInterval(timerInt); return; }
      $('timer').textContent = '用时 ' + fmtTime(Date.now() - state.startAt);
    }, 1000);
  }

  function renderCard() {
    var pos = state.idx;
    var it = FLAT[state.paper[pos]];
    var q = it.q;
    var u = state.answers[pos];
    var lk = state.locked[pos];
    var c = correctOf(q);
    var html = '<div class="qhead"><span class="qno">第 ' + (pos + 1) + ' 题</span>' +
      '<span class="badge ' + TYPE_CLS[q.t] + '">' + TYPE_LABEL[q.t] + '</span>' +
      (state.mode === 'full' ? '<span style="color:#999;font-size:12px;">（原题库第 ' + it.no + ' 题）</span>' : '') +
      '</div><div class="stem">' + q.stem + '</div>';
    if (lk) {
      html += '<div class="feedback ' + (isCorrect(q, u) ? 'ok' : 'bad') + '">' +
        (isCorrect(q, u) ? '✓ 回答正确' : '✗ 回答错误，正确答案：' + c) + '</div>';
    }
    if (q.t === 'judge') {
      html += '<div class="judgewrap">' +
        judgeBtn('对', u === '对', lk, c) + judgeBtn('错', u === '错', lk, c) + '</div>';
    } else {
      q.opts.forEach(function (op) {
        var sel = q.t === 'multi' ? (Array.isArray(u) && u.indexOf(op[0]) >= 0) : (u === op[0]);
        var cls = 'opt';
        if (sel) cls += ' selected';
        if (lk) {
          cls += ' locked';
          if (c.indexOf(op[0]) >= 0) cls += ' ok';
          else if (sel) cls += ' bad';
        }
        html += '<div class="' + cls + '" data-lt="' + op[0] + '">' +
          '<span class="lt">' + op[0] + '</span><span>' + op[1] + '</span></div>';
      });
    }
    if (!lk) {
      var canConfirm = q.t === 'multi' ? (Array.isArray(u) && u.length > 0) : (u != null);
      var confirmLabel = q.t === 'multi'
        ? '确认答案（已选 ' + (Array.isArray(u) ? u.length : 0) + ' 项）'
        : '确认答案';
      html += '<button class="confirmbtn" data-confirm="1"' + (canConfirm ? '' : ' disabled') + '>' + confirmLabel + '</button>';
    }
    $('qcard').innerHTML = html;
    if (!lk) {
      $('qcard').querySelectorAll('.opt').forEach(function (el) {
        el.onclick = function () { choose(pos, el.dataset.lt, q.t === 'multi'); };
      });
      $('qcard').querySelectorAll('.judgebtn').forEach(function (el) {
        el.onclick = function () { choose(pos, el.dataset.lt, false); };
      });
      var cb = $('qcard').querySelector('.confirmbtn');
      if (cb) cb.onclick = function () { confirmAnswer(pos); };
    }
  }

  function judgeBtn(label, sel, lk, c) {
    var cls = 'judgebtn';
    if (sel) cls += ' selected';
    if (lk) {
      if (c === label) cls += ' ok';
      else if (sel) cls += ' bad';
    }
    return '<button class="' + cls + '" data-lt="' + label + '"' + (lk ? ' disabled' : '') + '>' + label + '</button>';
  }

  function choose(pos, val, isMulti) {
    if (state.locked[pos]) return;
    var cur = state.answers[pos];
    if (isMulti) {
      var arr = Array.isArray(cur) ? cur.slice() : [];
      var i = arr.indexOf(val);
      if (i >= 0) arr.splice(i, 1); else arr.push(val);
      state.answers[pos] = arr;
    } else {
      state.answers[pos] = val; // 仅选中，点「确认答案」后才锁定判定
    }
    save();
    renderCard();
    renderGrid();
  }

  function confirmAnswer(pos) {
    if (state.locked[pos]) return;
    var u = state.answers[pos];
    if (u == null || (Array.isArray(u) && u.length === 0)) return;
    state.locked[pos] = true;
    save();
    renderCard();
    renderGrid();
  }

  function renderGrid() {
    var per = state.mode === 'full' ? 100 : state.paper.length;
    var base = state.mode === 'full' ? blockOf() * 100 : 0;
    var html = '';
    for (var i = 0; i < per; i++) {
      var pos = base + i;
      var lk = state.locked[pos];
      var cls = 'qcell';
      if (lk) {
        cls += isCorrect(FLAT[state.paper[pos]].q, state.answers[pos]) ? ' answered' : ' wrong';
      } else if (pos === state.idx) {
        cls += ' current';
      }
      html += '<div class="' + cls + '" data-pos="' + pos + '">' + (i + 1) + '</div>';
    }
    $('qgrid').innerHTML = html;
    $('qgrid').querySelectorAll('.qcell').forEach(function (el) {
      el.onclick = function () {
        state.idx = Number(el.dataset.pos);
        renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
      };
    });
  }

  function submit() {
    if (state.submitted) return;
    var unanswered = state.locked.filter(function (l) { return !l; }).length;
    if (unanswered > 0 && !confirm('还有 ' + unanswered + ' 题未作答，确定交卷吗？')) return;
    state.submitted = true;
    addRecord();
    save();
    clearInterval(timerInt);
    showResult();
  }

  /* ---------- 结果页 ---------- */
  var reviewFilter = 'wrong'; // all | wrong

  function showResult() {
    $('start').classList.add('hidden');
    $('exam').classList.add('hidden');
    $('result').classList.remove('hidden');
    var r = compute();
    var secs = state.historyView ? state.secsOverride : Math.round((Date.now() - state.startAt) / 1000);
    var pt = r.perType;
    var isMock = state.mode === 'mock';
    var extra = isMock
      ? '<div class="stat"><b>' + pt.single.s + ' / ' + pt.single.n + '</b>单选题</div>' +
        '<div class="stat"><b>' + pt.multi.s + ' / ' + pt.multi.n + '</b>多选题</div>' +
        '<div class="stat"><b>' + pt.judge.s + ' / ' + pt.judge.n + '</b>判断题</div>'
      : (function () {
          var rows = '<div class="stat"><b>' + pt.single.s + ' / ' + pt.single.n + '</b>单选题</div>' +
            '<div class="stat"><b>' + pt.multi.s + ' / ' + pt.multi.n + '</b>多选题</div>' +
            '<div class="stat"><b>' + pt.judge.s + ' / ' + pt.judge.n + '</b>判断题</div>';
          var pb = r.perBlock;
          for (var b = 0; b < pb.length; b++) {
            rows += '<div class="stat"><b>' + pb[b].s + ' / ' + pb[b].n + '</b>第' + (b + 1) + '组</div>';
          }
          return rows;
        })();
    $('resultBox').innerHTML =
      '<h2>' + (state.historyView ? fmtDate(state.ts) + ' · ' : '') + (isMock ? '随机模拟卷 · ' : '完整训练 · ') + (state.name ? state.name + ' · ' : '') + '答题成绩</h2>' +
      '<div class="bigscore">' + r.right + '<small> / ' + r.total + ' 分</small></div>' +
      '<div style="color:#888;font-size:14px;margin-top:8px;">答题用时：<b style="color:#1a3c6e;">' + secs + '</b> 秒（' + fmtTime(secs * 1000) + '）· 未作答 ' + r.unanswered + ' 题</div>' +
      '<div class="statrow">' + extra + '</div>';
    $('filters').innerHTML =
      '<button data-f="wrong" class="' + (reviewFilter === 'wrong' ? 'active' : '') + '">只看错题 / 未答</button>' +
      '<button data-f="all" class="' + (reviewFilter === 'all' ? 'active' : '') + '">全部题目</button>';
    $('filters').querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () { reviewFilter = btn.dataset.f; renderReview(); };
    });
    $('redoExamBtn').classList.toggle('hidden', state.historyView);
    $('redoBtn').textContent = '返回首页';
    renderReview();
  }

  function renderReview() {
    var html = '';
    state.paper.forEach(function (fi, pos) {
      var q = FLAT[fi].q;
      var u = state.answers[pos];
      var lk = state.locked[pos];
      var ok = lk && isCorrect(q, u);
      if (reviewFilter === 'wrong' && ok) return;
      var c = correctOf(q);
      html += '<div class="revcard">' +
        '<div class="qhead"><span class="qno">第 ' + (pos + 1) + ' 题</span>' +
        '<span class="badge ' + TYPE_CLS[q.t] + '">' + TYPE_LABEL[q.t] + '</span>' +
        (state.mode === 'full' ? '<span style="color:#999;font-size:12px;">（原题库第 ' + (fi + 1) + ' 题）</span>' : '') +
        (ok ? '<span style="color:#1e8e4d;font-size:13px;">✓ 正确</span>' :
          (!lk ? '<span style="color:#999;font-size:13px;">未作答</span>' : '<span style="color:#c0392b;font-size:13px;">✗ 错误</span>')) +
        '</div><div class="revstem">' + q.stem + '</div>';
      if (q.t === 'judge') {
        var myv = u == null ? '未选' : u;
        html += '<div class="revopt' + (u === c ? ' ok' : ' bad') + '">我的答案：' + myv + '</div>';
        html += '<div class="revopt ok">正确答案：' + c + '</div>';
      } else {
        q.opts.forEach(function (op) {
          var isC = c.indexOf(op[0]) >= 0;
          var isM = q.t === 'multi' ? (Array.isArray(u) && u.indexOf(op[0]) >= 0) : (u === op[0]);
          var cls = 'revopt';
          if (isC && isM) cls += ' ok';
          else if (isM && !isC) cls += ' bad';
          else if (isC) cls += ' ok';
          html += '<div class="' + cls + '">' + op[0] + '. ' + op[1] + (isC ? ' ✓' : (isM ? ' ✗ 你的选择' : '')) + '</div>';
        });
      }
      html += '<div class="revans">正确答案：' + c + '</div></div>';
    });
    if (!html) html = '<div style="text-align:center;color:#888;padding:30px;">太棒了，没有错题！</div>';
    $('review').innerHTML = html;
  }

  /* ---------- 事件绑定 ---------- */
  function requireName() {
    var name = $('nameInput').value.trim();
    if (!name) { alert('请先输入姓名或学号'); return null; }
    return name;
  }
  $('fullBtn').onclick = function () {
    var name = requireName();
    if (!name) return;
    var saved = loadKey(KEY_FULL);
    if (saved && !saved.submitted) {
      state = saved; // 继续上次完整训练
    } else {
      state = newState('full', FLAT.map(function (_, i) { return i; }));
    }
    state.name = name;
    save();
    showExam();
  };
  $('mockBtn').onclick = function () {
    var name = requireName();
    if (!name) return;
    state = newState('mock', genMockPaper());
    state.name = name;
    save();
    showExam();
  };
  $('resumeMockBtn').onclick = function () {
    var saved = loadKey(KEY_MOCK);
    if (saved && !saved.submitted) { state = saved; showExam(); }
  };
  $('prevBtn').onclick = function () {
    if (state.idx > 0) state.idx--;
    renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
  };
  $('nextBtn').onclick = function () {
    if (state.idx < state.paper.length - 1) state.idx++;
    renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
  };
  $('submitBtn').onclick = submit;
  $('redoExamBtn').onclick = function () {
    var name = state.name;
    state = state.mode === 'mock' ? newState('mock', genMockPaper()) : newState('full', FLAT.map(function (_, i) { return i; }));
    state.name = name;
    save();
    showExam();
  };
  $('redoBtn').onclick = function () {
    clearStores();
    state = null;
    showStart();
  };

  function blockOf() { return Math.floor(state.idx / 100); }

  /* ---------- 启动 ---------- */
  var savedFull = loadKey(KEY_FULL);
  if (savedFull) {
    state = savedFull;
    if (state.submitted) showResult(); else showExam();
  } else {
    showStart();
  }
})();
