/* 智盛杯训练题 500 题在线答题 */
(function () {
  'use strict';

  var DATA = window.QDATA.blocks;
  var FLAT = [];
  DATA.forEach(function (blk, bi) {
    blk.forEach(function (q, i) {
      FLAT.push({ q: q, no: bi * 100 + i + 1, block: bi });
    });
  });
  var TOTAL = FLAT.length;
  var TYPE_LABEL = { single: '单选题', multi: '多选题', judge: '判断题' };
  var TYPE_CLS = { single: 'single', multi: 'multi', judge: 'judge' };
  var STORE_KEY = 'zsb500_v1';

  function decode(ans64) { return atob(ans64); }
  function correctOf(q) { return decode(q.ans64); }

  var state = {
    name: '',
    answers: new Array(TOTAL).fill(null),
    startAt: null,
    submitted: false,
    idx: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  var timerInt = null;

  /* ---------- 存取 ---------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s.answers || s.answers.length !== TOTAL) return false;
      state = s;
      return true;
    } catch (e) { return false; }
  }
  function clearStore() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
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
    FLAT.forEach(function (it) {
      var u = state.answers[it.no - 1];
      var ok = isCorrect(it.q, u);
      if (u == null) unanswered++;
      else if (ok) right++;
      perType[it.q.t].n++;
      if (ok) perType[it.q.t].s++;
      perBlock[it.block].n++;
      if (ok) perBlock[it.block].s++;
    });
    return { right: right, unanswered: unanswered, perType: perType, perBlock: perBlock };
  }

  /* ---------- 开始页 ---------- */
  function showStart() {
    $('start').classList.remove('hidden');
    $('exam').classList.add('hidden');
    $('result').classList.add('hidden');
    $('nameInput').value = state.name || '';
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
    for (var b = 0; b < DATA.length; b++) {
      html += '<button class="tab' + (state.block() === b ? ' active' : '') + '" data-block="' + b + '">第' + (b + 1) + '组</button>';
    }
    $('tabs').innerHTML = html;
    $('tabs').querySelectorAll('.tab').forEach(function (btn) {
      btn.onclick = function () {
        state.idx = Number(btn.dataset.block) * 100;
        renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
      };
    });
  }

  function renderInfo() {
    $('counter').textContent = '第 ' + (state.idx + 1) + ' / ' + TOTAL + ' 题';
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
    var it = FLAT[state.idx];
    var q = it.q;
    var u = state.answers[it.no - 1];
    var html = '<div class="qhead"><span class="qno">第 ' + it.no + ' 题</span>' +
      '<span class="badge ' + TYPE_CLS[q.t] + '">' + TYPE_LABEL[q.t] + '</span></div>' +
      '<div class="stem">' + q.stem + '</div>';
    if (q.t === 'judge') {
      html += '<div class="judgewrap">' +
        judgeBtn('对', u === '对') + judgeBtn('错', u === '错') + '</div>';
    } else {
      q.opts.forEach(function (op) {
        var sel = q.t === 'multi' ? (Array.isArray(u) && u.indexOf(op[0]) >= 0) : (u === op[0]);
        html += '<div class="opt' + (sel ? ' selected' : '') + '" data-lt="' + op[0] + '">' +
          '<span class="lt">' + op[0] + '</span><span>' + op[1] + '</span></div>';
      });
    }
    $('qcard').innerHTML = html;
    $('qcard').querySelectorAll('.opt').forEach(function (el) {
      el.onclick = function () { choose(it.no, el.dataset.lt, q.t === 'multi'); };
    });
    $('qcard').querySelectorAll('.judgebtn').forEach(function (el) {
      el.onclick = function () { choose(it.no, el.dataset.lt, false); };
    });
  }

  function judgeBtn(label, sel) {
    return '<button class="judgebtn' + (sel ? ' selected' : '') + '" data-lt="' + label + '">' + label + '</button>';
  }

  function choose(no, val, isMulti) {
    var cur = state.answers[no - 1];
    if (isMulti) {
      var arr = Array.isArray(cur) ? cur.slice() : [];
      var i = arr.indexOf(val);
      if (i >= 0) arr.splice(i, 1); else arr.push(val);
      state.answers[no - 1] = arr;
    } else {
      state.answers[no - 1] = val;
    }
    save();
    renderCard();
    renderGrid();
    renderInfo();
  }

  function renderGrid() {
    var b = state.block();
    var html = '';
    for (var i = 0; i < 100; i++) {
      var no = b * 100 + i + 1;
      var u = state.answers[no - 1];
      var cls = 'qcell';
      if (i === state.idx % 100) cls += ' current';
      else if (u != null) cls += ' answered';
      html += '<div class="' + cls + '" data-idx="' + (b * 100 + i) + '">' + (i + 1) + '</div>';
    }
    $('qgrid').innerHTML = html;
    $('qgrid').querySelectorAll('.qcell').forEach(function (el) {
      el.onclick = function () {
        state.idx = Number(el.dataset.idx);
        renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
      };
    });
  }

  function submit() {
    if (state.submitted) return;
    var unanswered = state.answers.filter(function (u) { return u == null; }).length;
    if (unanswered > 0 && !confirm('还有 ' + unanswered + ' 题未作答，确定交卷吗？')) return;
    state.submitted = true;
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
    var time = fmtTime(state.submitted ? (Date.now() - state.startAt) : 0);
    var pt = r.perType, pb = r.perBlock;
    var blockRows = '';
    for (var b = 0; b < pb.length; b++) {
      blockRows += '<div class="stat"><b>' + pb[b].s + ' / ' + pb[b].n + '</b>第' + (b + 1) + '组</div>';
    }
    $('resultBox').innerHTML =
      '<h2>' + (state.name ? state.name + ' · ' : '') + '答题成绩</h2>' +
      '<div class="bigscore">' + r.right + '<small> / ' + TOTAL + ' 分</small></div>' +
      '<div style="color:#888;font-size:13px;margin-top:6px;">用时 ' + time + ' · 未作答 ' + r.unanswered + ' 题</div>' +
      '<div class="statrow">' +
      '<div class="stat"><b>' + pt.single.s + ' / ' + pt.single.n + '</b>单选题</div>' +
      '<div class="stat"><b>' + pt.multi.s + ' / ' + pt.multi.n + '</b>多选题</div>' +
      '<div class="stat"><b>' + pt.judge.s + ' / ' + pt.judge.n + '</b>判断题</div>' +
      blockRows +
      '</div>';
    $('filters').innerHTML =
      '<button data-f="wrong" class="' + (reviewFilter === 'wrong' ? 'active' : '') + '">只看错题 / 未答</button>' +
      '<button data-f="all" class="' + (reviewFilter === 'all' ? 'active' : '') + '">全部题目</button>';
    $('filters').querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () { reviewFilter = btn.dataset.f; renderReview(); };
    });
    renderReview();
  }

  function renderReview() {
    var html = '';
    FLAT.forEach(function (it) {
      var u = state.answers[it.no - 1];
      var ok = isCorrect(it.q, u);
      if (reviewFilter === 'wrong' && ok) return;
      var q = it.q;
      var c = correctOf(q);
      html += '<div class="revcard">' +
        '<div class="qhead"><span class="qno">第 ' + it.no + ' 题</span>' +
        '<span class="badge ' + TYPE_CLS[q.t] + '">' + TYPE_LABEL[q.t] + '</span>' +
        (ok ? '<span style="color:#1e8e4d;font-size:13px;">✓ 正确</span>' :
          (u == null ? '<span style="color:#999;font-size:13px;">未作答</span>' : '<span style="color:#c0392b;font-size:13px;">✗ 错误</span>')) +
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
  $('startBtn').onclick = function () {
    var name = $('nameInput').value.trim();
    if (!name) { alert('请先输入姓名或学号'); return; }
    state.name = name;
    save();
    showExam();
  };
  $('prevBtn').onclick = function () {
    if (state.idx > 0) state.idx--;
    renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
  };
  $('nextBtn').onclick = function () {
    if (state.idx < TOTAL - 1) state.idx++;
    renderTabs(); renderInfo(); renderCard(); renderGrid(); save();
  };
  $('submitBtn').onclick = submit;
  $('redoBtn').onclick = function () {
    clearStore();
    state = {
      name: '', answers: new Array(TOTAL).fill(null),
      startAt: null, submitted: false, idx: 0
    };
    showStart();
  };

  state.block = function () { return Math.floor(state.idx / 100); };

  /* ---------- 启动 ---------- */
  if (load()) {
    if (state.submitted) showResult();
    else showExam();
  } else {
    showStart();
  }
})();
