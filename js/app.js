// ══════════════════════════════════════════════════════════════════
// STATE MANAGEMENT — localStorage persistence
// ══════════════════════════════════════════════════════════════════
const SAVE_KEY = 'beehive2_v3_global';
let STATE = loadState();

function defaultState() {
  return {
    score: 0,
    answers: {},        // "ui-li-ei": chosen index or string for scramble
    tfAnswers: {},      // "ui-li-ti": true/false
    completedLessons: [],
    audioPlayed: 0,
    lastUnit: 0,
    lastLesson: 0,
    theme: 'light',
    appMode: 'lessons',
    testAnswers: {},
    testChecked: {},
    speakDone: {},
    wbAnswers: {},
    wbChecked: {},
    bookUnit: 0,
    bookPageIdx: 0,
    workbookUnit: 0,
    testUnit: 0
  };
}

function loadState() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) return { ...defaultState(), ...JSON.parse(s) };
  } catch(e) {}
  return defaultState();
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(STATE));
  } catch(e) {}
  updateOverviewBar();
  updateUnitTabProgress();
}

function resetProgress() {
  if (!confirm('Reset all progress? This cannot be undone.')) return;
  STATE = defaultState();
  STATE.theme = document.documentElement.getAttribute('data-theme') || 'light';
  saveState();
  buildApp();
}

// ══════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
}
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  applyTheme(STATE.theme);
  saveState();
}
applyTheme(STATE.theme || 'light');

// ══════════════════════════════════════════════════════════════════
// AUDIO ENGINE (PROFESSIONAL & GLOBAL DEVELOPMENT)
// ══════════════════════════════════════════════════════════════════
let activeAudio = null;
let activeAudioId = null;

function formatTime(sec) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function initAudioPlayer(audioId) {
  const audio = document.getElementById(audioId);
  if (!audio) return;

  const playBtn = document.getElementById('btn_' + audioId);
  const timeEl = document.getElementById('t_' + audioId);
  const seek = document.getElementById('seek_' + audioId);
  const volumeSlider = document.getElementById('vol_' + audioId);
  const muteBtn = document.getElementById('mute_' + audioId);

  // Time and progress updates
  audio.ontimeupdate = () => {
    if (timeEl) timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    if (seek && audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  };

  // Loading / buffering indicator
  audio.onwaiting = () => {
    if (playBtn) playBtn.innerHTML = '<div class="ap-spinner"></div>';
  };
  audio.onplaying = () => {
    if (playBtn) playBtn.textContent = '⏸';
  };

  audio.onended = () => {
    if (playBtn) {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
    }
    if (seek) seek.value = 0;
    activeAudio = null;
    activeAudioId = null;
  };

  // Seek bar input
  if (seek) {
    seek.oninput = () => {
      if (audio.duration) {
        audio.currentTime = (seek.value / 100) * audio.duration;
      }
    };
  }

  // Volume slider input
  if (volumeSlider) {
    volumeSlider.oninput = () => {
      audio.volume = volumeSlider.value / 100;
      audio.muted = (audio.volume === 0);
      if (muteBtn) muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    };
  }
}

function playAudio(audioId) {
  const audio = document.getElementById(audioId);
  if (!audio) return;

  const playBtn = document.getElementById('btn_' + audioId);

  if (activeAudio && activeAudio !== audio) {
    audio.pause(); // Just safety
    const oldPlayBtn = document.getElementById('btn_' + activeAudioId);
    if (oldPlayBtn) {
      oldPlayBtn.classList.remove('playing');
      oldPlayBtn.textContent = '▶';
    }
  }

  if (audio.paused) {
    // Lazy bind events on first play
    if (!audio.dataset.initialized) {
      initAudioPlayer(audioId);
      audio.dataset.initialized = 'true';
    }

    // Stop current active if exists
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }

    audio.play().then(() => {
      if (playBtn) {
        playBtn.classList.add('playing');
        playBtn.textContent = '⏸';
      }
      activeAudio = audio;
      activeAudioId = audioId;

      // Stats increment
      STATE.audioPlayed = (STATE.audioPlayed || 0) + 1;
      saveState();
    }).catch(() => {});
  } else {
    audio.pause();
    if (playBtn) {
      playBtn.classList.remove('playing');
      playBtn.textContent = '▶';
    }
    activeAudio = null;
    activeAudioId = null;
  }
}

function skipAudio(audioId, seconds) {
  const audio = document.getElementById(audioId);
  if (audio) {
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  }
}

function toggleMute(audioId) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  const muteBtn = document.getElementById('mute_' + audioId);
  const volumeSlider = document.getElementById('vol_' + audioId);

  audio.muted = !audio.muted;
  if (muteBtn) muteBtn.textContent = audio.muted ? '🔇' : '🔊';
  if (volumeSlider) volumeSlider.value = audio.muted ? 0 : (audio.volume * 100);
}

// ══════════════════════════════════════════════════════════════════
// SCORE & CONFETTI
// ══════════════════════════════════════════════════════════════════
function addScore(pts) {
  STATE.score = (STATE.score || 0) + pts;
  saveState();
  showScoreToast('+' + pts + ' pts ⭐');
  confetti();
}

function showScoreToast(msg) {
  const t = document.createElement('div');
  t.className = 'score-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function confetti() {
  const layer = document.getElementById('confettiLayer');
  if (!layer) return;
  const cols = ['#FFD700','#FF8C00','#22C55E','#0EA5E9','#EC4899','#8B5CF6','#F97316'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'cp';
    const size = Math.random() * 9 + 5;
    p.style.cssText = `left:${Math.random()*100}%;top:0;background:${cols[Math.floor(Math.random()*7)]};width:${size}px;height:${size}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${Math.random()*2+1.5}s;animation-delay:${Math.random()*.4}s;`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}

// ══════════════════════════════════════════════════════════════════
// EXERCISE HANDLERS (CLASSIC & NEW PLAY STYLES)
// ══════════════════════════════════════════════════════════════════

// 1. Multiple Choice (MCQ)
function checkMC(ui, li, ei, chosen, correct) {
  const key = `${ui}-${li}-${ei}`;
  if (STATE.answers[key] !== undefined) return;
  STATE.answers[key] = chosen;

  const box = document.getElementById(`ex_${ui}_${li}_${ei}`);
  const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
  if (!box) return;

  box.dataset.done = '1';
  const opts = box.querySelectorAll('.mc-opt');
  opts.forEach((o, i) => {
    o.disabled = true;
    if (i === correct) o.classList.add('correct');
    const letterEl = o.querySelector('.mc-letter');
    if (letterEl && i === correct) {
      letterEl.style.background = '#22C55E';
      letterEl.style.color = '#fff';
    }
  });

  if (chosen !== correct) {
    opts[chosen].classList.add('wrong');
    const wrongLetter = opts[chosen].querySelector('.mc-letter');
    if (wrongLetter) {
      wrongLetter.style.background = '#EF4444';
      wrongLetter.style.color = '#fff';
    }
    if (fb) {
      fb.textContent = '❌ Not quite! See the correct answer highlighted above.';
      fb.className = 'feedback show bad';
    }
  } else {
    if (fb) {
      fb.textContent = '✅ Excellent! Well done!';
      fb.className = 'feedback show good';
    }
    addScore(10);
  }
  saveState();
}

// 2. True / False (T/F)
function checkTF(ui, li, idx, chosen, correct) {
  const key = `${ui}-${li}-${idx}`;
  if (STATE.tfAnswers[key] !== undefined) return;
  STATE.tfAnswers[key] = chosen;

  const row = document.getElementById(`tf_${ui}_${li}_${idx}`);
  const ico = document.getElementById(`tf_ico_${ui}_${li}_${idx}`);
  if (!row) return;

  row.dataset.done = '1';
  const btns = row.querySelectorAll('.tf-btn');
  btns.forEach(b => b.disabled = true);
  row.style.borderColor = chosen === correct ? '#22C55E' : '#EF4444';

  if (chosen === correct) {
    (chosen ? btns[0] : btns[1]).classList.add('correct');
    if (ico) ico.textContent = '✅';
    addScore(5);
  } else {
    (chosen ? btns[0] : btns[1]).classList.add('wrong');
    (correct ? btns[0] : btns[1]).classList.add('correct');
    if (ico) ico.textContent = '❌';
  }
  saveState();
}

// 3. Word Scramble (NEW GAMEPLAY)
let activeScrambleGuesses = {};

function makeScrambleGuess(ui, li, ei, letter, btnIndex, targetWord) {
  const key = `${ui}-${li}-${ei}`;
  if (STATE.answers[key] !== undefined) return;

  if (!activeScrambleGuesses[key]) {
    activeScrambleGuesses[key] = [];
  }

  activeScrambleGuesses[key].push({ letter, btnIndex });

  const btn = document.getElementById(`scr_btn_${ui}_${li}_${ei}_${btnIndex}`);
  if (btn) btn.disabled = true;

  const guessWord = activeScrambleGuesses[key].map(g => g.letter).join('');
  const slots = document.querySelectorAll(`#scr_slots_${ui}_${li}_${ei} .scramble-slot`);
  
  for (let i = 0; i < targetWord.length; i++) {
    if (i < guessWord.length) {
      slots[i].textContent = guessWord[i];
      slots[i].classList.add('filled');
    } else {
      slots[i].textContent = '';
      slots[i].classList.remove('filled');
    }
  }

  if (guessWord.length === targetWord.length) {
    if (guessWord.toLowerCase() === targetWord.toLowerCase()) {
      STATE.answers[key] = targetWord;
      slots.forEach(slot => {
        slot.classList.remove('filled');
        slot.classList.add('correct');
      });
      const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
      if (fb) {
        fb.textContent = '🎉 Awesome spelling! You unscrambled the word!';
        fb.className = 'feedback show good';
      }
      addScore(15);
      saveState();

      const resetBtn = document.getElementById(`scr_reset_${ui}_${li}_${ei}`);
      if (resetBtn) resetBtn.style.display = 'none';
    } else {
      slots.forEach(slot => {
        slot.classList.add('wrong');
      });
      const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
      if (fb) {
        fb.textContent = '❌ That spelling is incorrect. Try resetting!';
        fb.className = 'feedback show bad';
      }
    }
  }
}

function resetScramble(ui, li, ei) {
  const key = `${ui}-${li}-${ei}`;
  activeScrambleGuesses[key] = [];

  const buttons = document.querySelectorAll(`.scr-lbtn-${ui}-${li}-${ei}`);
  buttons.forEach(btn => btn.disabled = false);

  const slots = document.querySelectorAll(`#scr_slots_${ui}_${li}_${ei} .scramble-slot`);
  slots.forEach(slot => {
    slot.textContent = '';
    slot.classList.remove('filled', 'correct', 'wrong');
  });

  const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
  if (fb) {
    fb.className = 'feedback';
    fb.textContent = '';
  }
}

// 4. Fill in the Blanks (NEW GAMEPLAY)
function selectBlankOption(ui, li, ei, chosenIdx, correctIdx, optionWord) {
  const key = `${ui}-${li}-${ei}`;
  if (STATE.answers[key] !== undefined) return;
  STATE.answers[key] = chosenIdx;

  const sentenceEl = document.getElementById(`blank_sent_${ui}_${li}_${ei}`);
  const blankSpace = sentenceEl.querySelector('.blank-space');
  const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);

  if (blankSpace) {
    blankSpace.textContent = optionWord;
    blankSpace.classList.add('filled');
  }

  const container = document.getElementById(`blank_opts_${ui}_${li}_${ei}`);
  const buttons = container.querySelectorAll('.mc-opt');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIdx) {
      btn.classList.add('correct');
      const letter = btn.querySelector('.mc-letter');
      if (letter) letter.style.background = '#22C55E';
    }
  });

  if (chosenIdx === correctIdx) {
    if (blankSpace) blankSpace.classList.add('correct');
    if (fb) {
      fb.textContent = '✅ Fantastic choice!';
      fb.className = 'feedback show good';
    }
    addScore(10);
  } else {
    if (blankSpace) blankSpace.classList.add('wrong');
    buttons[chosenIdx].classList.add('wrong');
    const wrongLetter = buttons[chosenIdx].querySelector('.mc-letter');
    if (wrongLetter) wrongLetter.style.background = '#EF4444';
    
    if (fb) {
      fb.textContent = `❌ Not quite. The correct sentence is shown above.`;
      fb.className = 'feedback show bad';
    }
  }
  saveState();
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW BAR & UNIT TAB PROGRESS
// ══════════════════════════════════════════════════════════════════
function updateOverviewBar() {
  const totalEx = Object.keys(STATE.answers).length + Object.keys(STATE.tfAnswers).length;
  const scoreEl = document.getElementById('ov-score');
  const lessonsEl = document.getElementById('ov-lessons');
  const exEl = document.getElementById('ov-ex');
  const audioEl = document.getElementById('ov-audio');

  if (scoreEl) scoreEl.textContent = STATE.score || 0;
  if (lessonsEl) lessonsEl.textContent = (STATE.completedLessons || []).length;
  if (exEl) exEl.textContent = totalEx;
  if (audioEl) audioEl.textContent = STATE.audioPlayed || 0;
}

function getUnitProgress(ui) {
  const u = UNITS[ui];
  if (!u) return 0;
  const total = u.lessons.length;
  const done = u.lessons.filter((_, li) => (STATE.completedLessons || []).includes(`${ui}-${li}`)).length;
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function updateUnitTabProgress() {
  UNITS.forEach((_, ui) => {
    const fill = document.getElementById(`upf_${ui}`);
    if (fill) fill.style.width = getUnitProgress(ui) + '%';
  });
}

// ══════════════════════════════════════════════════════════════════
// STATS PANEL / CONTROL PANEL
// ══════════════════════════════════════════════════════════════════
function openStats() {
  const totalEx = Object.keys(STATE.answers).length;
  const totalTF = Object.keys(STATE.tfAnswers).length;
  
  let correctEx = 0;
  Object.entries(STATE.answers).forEach(([k, v]) => {
    const [ui, li, ei] = k.split('-').map(Number);
    const exercise = UNITS[ui]?.lessons[li]?.exercises?.[ei];
    if (exercise) {
      if (exercise.type === 'mc' || exercise.type === 'blank') {
        if (exercise.ans === v) correctEx++;
      } else if (exercise.type === 'scramble') {
        if (exercise.word.toLowerCase() === String(v).toLowerCase()) correctEx++;
      }
    }
  });

  const accuracy = totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : 0;

  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card"><span class="sc-val">${STATE.score || 0}</span><span class="sc-label">⭐ Total Score</span></div>
      <div class="stat-card"><span class="sc-val">${(STATE.completedLessons || []).length}</span><span class="sc-label">📚 Lessons Done</span></div>
      <div class="stat-card"><span class="sc-val">${totalEx + totalTF}</span><span class="sc-label">🎯 Tasks Solved</span></div>
      <div class="stat-card"><span class="sc-val">${accuracy}%</span><span class="sc-label">✅ Accuracy</span></div>
      <div class="stat-card"><span class="sc-val">${STATE.audioPlayed || 0}</span><span class="sc-label">🎵 Audio Plays</span></div>
      <div class="stat-card"><span class="sc-val">${UNITS.length}</span><span class="sc-label">📖 Total Units</span></div>
    `;
  }

  const badges = [
    { icon: '🌟', label: 'First Step', earned: (STATE.completedLessons || []).length >= 1 },
    { icon: '🎯', label: 'Quiz Master', earned: totalEx >= 10 },
    { icon: '🎵', label: 'Listener', earned: (STATE.audioPlayed || 0) >= 5 },
    { icon: '🏆', label: 'Unit Hero', earned: (STATE.completedLessons || []).length >= 6 },
    { icon: '⭐', label: '100 Points', earned: (STATE.score || 0) >= 100 },
    { icon: '🐝', label: 'Bee Expert', earned: (STATE.completedLessons || []).length >= 25 },
  ];

  const badgesRow = document.getElementById('badgesRow');
  if (badgesRow) {
    badgesRow.innerHTML = badges.map(b =>
      `<div class="badge ${b.earned ? 'earned' : ''}"><div class="badge-icon">${b.icon}</div>${b.label}</div>`
    ).join('');
  }

  const progressList = document.getElementById('unitProgressList');
  if (progressList) {
    progressList.innerHTML = UNITS.map((u, ui) => {
      const pct = getUnitProgress(ui);
      return `<div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">
          <span><span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;background:${u.color};color:#fff;font-size:.6rem;font-weight:900;margin-right:6px;">${u.num}</span>${u.title}</span>
          <span style="color:${pct === 100 ? '#22C55E' : u.color}">${pct}%</span>
        </div>
        <div style="background:var(--border);height:5px;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${u.color};border-radius:99px;transition:width .5s ease;"></div>
        </div>
      </div>`;
    }).join('');
  }

  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) statsPanel.classList.add('open');
}

function closeStats() {
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) statsPanel.classList.remove('open');
}

// ══════════════════════════════════════════════════════════════════
// RESOURCE & EXAM CENTER
// ══════════════════════════════════════════════════════════════════
function openResources() {
  // Stop active lesson audio if playing
  if (activeAudio) {
    activeAudio.pause();
    const oldPlayBtn = document.getElementById('btn_' + activeAudioId);
    if (oldPlayBtn) {
      oldPlayBtn.classList.remove('playing');
      oldPlayBtn.textContent = '▶';
    }
    activeAudio = null;
    activeAudioId = null;
  }

  // Populate Books List
  const booksList = document.getElementById('booksList');
  if (booksList) {
    booksList.innerHTML = `
      <div class="res-card">
        <div class="res-card-icon">📖</div>
        <h3>Student's Book</h3>
        <p>Full Oxford Students Coursebook with 10 units and Starter unit.</p>
        <a href="Beehive_British_2_Students_Book/Beehive_British_2_Students_Book_www.frenglish.ru.pdf" target="_blank" class="res-card-btn">Open PDF</a>
      </div>
      <div class="res-card">
        <div class="res-card-icon">✍️</div>
        <h3>Workbook</h3>
        <p>Oxford practice Workbook for extra activities and worksheets.</p>
        <a href="Beehive_British_2_Workbook/Beehive_British_2_Workbook_www.frenglish.ru.pdf" target="_blank" class="res-card-btn">Open PDF</a>
      </div>
    `;
  }

  // Populate General Tests List
  const generalTestsList = document.getElementById('generalTestsList');
  if (generalTestsList) {
    generalTestsList.innerHTML = `
      <!-- Entry Test -->
      <div class="res-row">
        <div class="res-row-info">
          <div class="res-row-title">Entry Test (اختبار تحديد المستوى)</div>
          <div class="res-row-subtitle">General assessment for students starting Beehive Level 2</div>
        </div>
        <div class="res-row-actions">
          <a href="Beehive_British_2_Tests/Entry Test/beehive-entry-test.pdf" target="_blank" class="res-row-btn">📄 Questions</a>
          <a href="Beehive_British_2_Tests/Entry Test/beehive-entry-test-key.pdf" target="_blank" class="res-row-btn">🔑 Key</a>
          <a href="Beehive_British_2_Tests/Entry Test/beehive-entry-test-guidance.pdf" target="_blank" class="res-row-btn">💡 Guide</a>
        </div>
      </div>

      <!-- End of Year Test -->
      <div class="res-row">
        <div class="res-row-info">
          <div class="res-row-title">End of Year Test (الاختبار النهائي)</div>
          <div class="res-row-subtitle">Final comprehensive exam for Level 2 units 1-10</div>
        </div>
        <div class="res-row-actions">
          <a href="Beehive_British_2_Tests/beehive2-end-of-year-test/Beehive_Tests_Level 2_End of year test.pdf" target="_blank" class="res-row-btn">📄 Exam Paper</a>
          <button class="res-row-btn play-btn" id="btn_test_eoy" onclick="playAudio('test_eoy')" title="Play Listening Track">▶ Listen</button>
          <audio id="test_eoy" src="Beehive_British_2_Tests/beehive2-end-of-year-test/Beehive Level 2 Tests_Item 014.mp3" preload="none"></audio>
        </div>
      </div>
    `;
  }

  // Populate Unit Tests List
  const unitTestsList = document.getElementById('unitTestsList');
  if (unitTestsList) {
    let unitHtml = '';
    for (let n = 1; n <= 10; n++) {
      const unitData = UNITS.find(u => u.num === String(n));
      const topic = unitData ? unitData.title : 'Unit ' + n;
      const folder = `beehive2-unit${n}-test`;
      const pdfPath = `Beehive_British_2_Tests/Unit Tests/${folder}/Beehive_Tests_Level 2_Unit test ${n}.pdf`;
      const mp3Path = `Beehive_British_2_Tests/Unit Tests/${folder}/Beehive Level 2 Tests_Item 0${n === 10 ? '10' : '0' + n}.mp3`;
      
      unitHtml += `
        <div class="res-row">
          <div class="res-row-info">
            <div class="res-row-title">Unit ${n} Test: ${topic}</div>
            <div class="res-row-subtitle">Listening & Reading assessment for Unit ${n}</div>
          </div>
          <div class="res-row-actions">
            <a href="${pdfPath}" target="_blank" class="res-row-btn">📄 Questions</a>
            <button class="res-row-btn play-btn" id="btn_test_u${n}" onclick="playAudio('test_u${n}')" title="Play Listening Track">▶ Listen</button>
            <audio id="test_u${n}" src="${mp3Path}" preload="none"></audio>
          </div>
        </div>
      `;
    }
    unitTestsList.innerHTML = unitHtml;
  }

  const resPanel = document.getElementById('resourcesPanel');
  if (resPanel) resPanel.classList.add('open');
}

function closeResources() {
  const resPanel = document.getElementById('resourcesPanel');
  if (resPanel) resPanel.classList.remove('open');

  // Pause test audio if it was playing when modal is closed
  if (activeAudio && activeAudioId && activeAudioId.startsWith('test_')) {
    activeAudio.pause();
    const oldPlayBtn = document.getElementById('btn_' + activeAudioId);
    if (oldPlayBtn) {
      oldPlayBtn.classList.remove('playing');
      oldPlayBtn.textContent = '▶';
    }
    activeAudio = null;
    activeAudioId = null;
  }
}

function switchResourceTab(tabId) {
  // Update active button state
  document.querySelectorAll('.res-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === `resTabBtn_${tabId}`);
  });

  // Toggle visible content
  document.querySelectorAll('.res-tab-content').forEach(content => {
    content.style.display = content.id === `resContent_${tabId}` ? 'block' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════════
// RENDERING & INTERFACE GENERATION
// ══════════════════════════════════════════════════════════════════
const NUM_COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#0EA5E9','#8B5CF6','#EC4899','#14B8A6'];
let currentUnit = STATE.lastUnit || 0;
let currentLesson = STATE.lastLesson || 0;

function buildApp() {
  initAppModes();
  
  if (STATE.appMode === 'lessons') {
    const rootUnit = document.getElementById('rootUnitSelector');
    const rootLesson = document.getElementById('rootLessonSelector');
    if (rootUnit) rootUnit.style.display = 'block';
    if (rootLesson) rootLesson.style.display = 'block';
    buildUnitTabs();
    renderUnit(currentUnit, currentLesson);
  } else {
    const rootUnit = document.getElementById('rootUnitSelector');
    const rootLesson = document.getElementById('rootLessonSelector');
    if (rootUnit) rootUnit.style.display = 'none';
    if (rootLesson) rootLesson.style.display = 'none';
    
    if (STATE.appMode === 'book') {
      initBook();
    } else if (STATE.appMode === 'workbook') {
      initWorkbook();
    } else if (STATE.appMode === 'tests') {
      initTests();
    }
  }
  updateOverviewBar();
}

function buildUnitTabs() {
  const tabs = document.getElementById('unitTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  UNITS.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.className = 'utab' + (i === currentUnit ? ' active' : '');
    btn.id = 'utab_' + i;
    btn.innerHTML = `<span class="unum" style="background:${u.color}">${u.num}</span>${u.title}<div class="uprogress"><div class="uprogress-fill" id="upf_${i}" style="width:${getUnitProgress(i)}%"></div></div>`;
    btn.onclick = () => {
      currentUnit = i;
      currentLesson = 0;
      renderUnit(i, 0);
    };
    tabs.appendChild(btn);
  });
}

function renderUnit(ui, startLesson) {
  currentUnit = ui;
  currentLesson = startLesson || 0;
  document.querySelectorAll('.utab').forEach((b, i) => b.classList.toggle('active', i === ui));
  buildLessonTabs(ui);
  renderLesson(ui, currentLesson);
  STATE.lastUnit = ui;
  STATE.lastLesson = currentLesson;
  saveState();
}

function buildLessonTabs(ui) {
  const lt = document.getElementById('lessonTabs');
  if (!lt) return;
  lt.innerHTML = '';
  UNITS[ui].lessons.forEach((l, li) => {
    const done = (STATE.completedLessons || []).includes(`${ui}-${li}`);
    const btn = document.createElement('button');
    btn.className = 'ltab' + (li === currentLesson ? ' active' : '');
    btn.id = `ltab_${ui}_${li}`;
    btn.innerHTML = `${l.label}${done ? '<span class="ltab-done">✓</span>' : ''}`;
    btn.onclick = () => {
      currentLesson = li;
      renderLesson(ui, li);
    };
    lt.appendChild(btn);
  });
}

function renderLesson(ui, li) {
  currentLesson = li;
  
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
    activeAudioId = null;
  }

  const key = `${ui}-${li}`;
  if (!(STATE.completedLessons || []).includes(key)) {
    STATE.completedLessons = STATE.completedLessons || [];
    STATE.completedLessons.push(key);
  }
  STATE.lastUnit = ui;
  STATE.lastLesson = li;
  saveState();

  buildLessonTabs(ui);
  document.querySelectorAll('.ltab').forEach((b, i) => b.classList.toggle('active', i === li));

  const u = UNITS[ui], l = u.lessons[li];
  const main = document.getElementById('mainContent');
  if (main) {
    main.innerHTML = `<div class="lesson-wrap">${buildLessonHTML(u, l, ui, li)}</div>`;
  }
  restoreAnswers(ui, li);
}

function buildLessonHTML(u, l, ui, li) {
  const pct = getUnitProgress(ui);
  
  const bookPageIdx = findPageForLesson(ui, l);
  let openBookBtn = '';
  if (bookPageIdx !== -1) {
    const pageNum = BOOK_UNITS[ui].pages[bookPageIdx].page;
    openBookBtn = `
      <button class="btn btn-ghost" onclick="jumpToBookPage(${ui}, ${bookPageIdx})" style="padding: 6px 12px; font-size: 0.72rem; border-color: var(--orange); color: var(--text-primary); display: inline-flex; align-items: center; gap: 6px;">
        📖 Student Book (p. ${pageNum})
      </button>
    `;
  }

  let html = `
    <div class="unit-hero" style="background:${u.bg}">
      <h2>${u.num === 'S' ? '🌟' : '🐝'} ${u.title}</h2>
      <p>${u.topic}</p>
      <div class="unit-hero-progress">
        <div class="uhp-label"><span>Unit Progress</span><span>${pct}%</span></div>
        <div class="uhp-bar"><div class="uhp-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <h3 style="font-family:'Fredoka One',cursive;font-size:1.35rem;color:var(--text-primary);margin:0;">${l.title}</h3>
      ${openBookBtn}
    </div>
  `;

  if (l.audio && l.audio.length) {
    html += `<div class="slabel">🔊 Audio Activities</div>`;
    l.audio.forEach(a => {
      const src = AUDIO[a.key] || '';
      const hasSrc = !!src;
      html += `
        <div class="audio-player theme-${l.theme || 'dark'}">
          <div class="ap-header">
            <div class="ap-title-area">
              <div class="ap-icon">🎧</div>
              <div class="ap-info">
                <strong class="ap-desc">${a.desc}</strong>
                <span class="ap-track">${a.label}</span>
              </div>
            </div>
            ${!hasSrc ? `<span class="ap-no-audio">Audio track not ready</span>` : ''}
          </div>
          ${hasSrc ? `
          <div class="ap-controls-row">
            <div class="ap-btns-group">
              <button class="ap-btn" onclick="skipAudio('${a.id}', -10)" title="Rewind 10s">⏪</button>
              <button class="ap-play" id="btn_${a.id}" onclick="playAudio('${a.id}')" title="Play / Pause">▶</button>
              <button class="ap-btn" onclick="skipAudio('${a.id}', 10)" title="Forward 10s">⏩</button>
            </div>
            
            <div class="ap-seek-container">
              <span class="ap-time" id="t_${a.id}">0:00 / 0:00</span>
              <input type="range" class="ap-seek" id="seek_${a.id}" min="0" max="100" value="0">
            </div>

            <div class="ap-volume-container">
              <button class="ap-btn" id="mute_${a.id}" onclick="toggleMute('${a.id}')" title="Mute/Unmute">🔊</button>
              <input type="range" class="ap-volume-slider" id="vol_${a.id}" min="0" max="100" value="80">
            </div>
            
            <audio id="${a.id}" src="${src}" preload="none"></audio>
          </div>` : ''}
        </div>`;
    });
  }

  if (l.vocab) {
    html += `<div class="slabel" style="margin-top:20px;">📦 Vocabulary</div>
    <div class="vocab-grid">`;
    l.vocab.forEach((v, i) => {
      html += `<div class="vcard" onclick="this.classList.toggle('revealed')">
        <span class="vnum" style="background:${NUM_COLORS[i%8]}">${i+1}</span>
        <span class="vemoji">${v.e}</span>
        <div class="vword">${v.w}</div>
      </div>`;
    });
    html += `</div>`;
  }

  if (l.grammar) {
    const g = l.grammar;
    html += `<div class="slabel">📐 Grammar</div>
    <div class="grammar-box" style="background:${g.bg};border-color:${g.border}">
      <h3 style="color:${g.hColor}">${g.title}</h3>`;
    g.patterns.forEach(p => {
      html += `<div class="gram-row">
        <span class="gram-q" style="background:${g.hColor}">${p.q}</span>
        ${p.a ? `<span>→</span><span class="gram-a" style="background:${p.aColor}">${p.a}</span>` : ''}
      </div>`;
    });
    html += `<div class="look-box">💡 <span>${g.note}</span></div></div>`;
  }

  if (l.funcLang) {
    const f = l.funcLang;
    html += `<div class="slabel">💬 Functional Language</div>
    <div class="func-box">
      <h3>🗣️ Useful Phrases</h3>
      <div class="gram-row">
        <span class="gram-q" style="background:#065F46">${f.q}</span>
        <span>→</span>
        <span class="gram-a" style="background:#059669">${f.a}</span>
      </div>
    </div>`;
  }

  if (l.song) {
    const s = l.song;
    html += `<div class="slabel">🎵 Song</div>
    <div class="song-box" style="background:${s.bg}">
      <h3>${s.title}</h3>
      <div class="lyrics-grid">`;
    s.cols.forEach(col => {
      html += `<div class="lyrics-col"><p>${col.replace(/\[(\w+)\]/g,'<span class="hw">$1</span>').replace(/\n/g,'<br>')}</p></div>`;
    });
    html += `</div></div>`;
  }

  if (l.culture) {
    html += `<div class="slabel">🌍 Culture Corner</div>`;
    l.culture.forEach(c => {
      html += `<div class="culture-box" style="background:${c.color}">
        <div class="culture-flag">${c.flag}</div>
        <div class="culture-info"><h3>${c.country}</h3><p>${c.desc}</p></div>
      </div>`;
    });
  }

  if (l.tf) {
    html += `<div class="slabel">🎮 True or False</div>`;
    l.tf.forEach((t, ti) => {
      html += `<div class="tf-row" id="tf_${ui}_${li}_${ti}">
        <div class="tf-stmt">${t.s}</div>
        <div class="tf-btns">
          <button class="tf-btn t" onclick="checkTF(${ui},${li},${ti},true,${t.ans})">✅ True</button>
          <button class="tf-btn f" onclick="checkTF(${ui},${li},${ti},false,${t.ans})">❌ False</button>
        </div>
        <div class="tf-ico" id="tf_ico_${ui}_${li}_${ti}"></div>
      </div>`;
    });
  }

  if (l.steps) {
    html += `<div class="slabel">📋 Project Steps</div>
    <div class="steps-grid">`;
    l.steps.forEach(s => {
      html += `<div class="step-card" style="border-top-color:${u.color}">
        <div class="step-n" style="background:${u.color}">${s.n}</div>
        <span class="step-icon">${s.icon}</span>
        <div class="step-text">${s.text}</div>
      </div>`;
    });
    html += `</div>`;
  }

  if (l.story) {
    const s = l.story;
    const themeGrad = {
      dark:'linear-gradient(135deg,#1A1A2E,#0F3460)',
      teal:'linear-gradient(135deg,#0F766E,#115E59)',
      purple:'linear-gradient(135deg,#4C1D95,#7C3AED)',
      red:'linear-gradient(135deg,#7F1D1D,#DC2626)',
      amber:'linear-gradient(135deg,#78350F,#D97706)',
    };
    html += `<div class="slabel">📖 Story</div>
    <div class="story-wrap">
      <div class="story-header" style="background:${themeGrad[l.theme]||themeGrad.dark}">
        <div class="story-header-emoji">${s.emoji}</div>
        <div class="story-header-title">${s.title}</div>
      </div>
      <div class="story-grid">`;
    s.panels.forEach(p => {
      html += `<div class="story-panel">
        <div class="panel-num">${p.n}</div>
        <div class="panel-scene">${p.scene}</div>`;
      p.lines.forEach(line => {
        html += `<div class="panel-line">${line}</div>`;
      });
      html += `</div>`;
    });
    html += `</div></div>`;
  }

  if (l.exercises) {
    html += `<div class="slabel">🎯 Exercises</div>`;
    l.exercises.forEach((ex, ei) => {
      if (ex.type === 'mc') {
        html += `<div class="ex-box" id="ex_${ui}_${li}_${ei}">
          <h4><span class="ex-num" style="background:${u.color}">${ei+1}</span>${ex.q.replace(/\n/g,'<br>')}</h4>
          <div>`;
        ex.opts.forEach((opt, oi) => {
          html += `<button class="mc-opt" onclick="checkMC(${ui},${li},${ei},${oi},${ex.ans})">
            <span class="mc-letter">${String.fromCharCode(65+oi)}</span>${opt}
          </button>`;
        });
        html += `</div><div class="feedback" id="fb_${ui}_${li}_${ei}"></div></div>`;
      } 
      else if (ex.type === 'tf') {
        ex.stmts.forEach((st, sti) => {
          const idx = `x${ei}_${sti}`;
          html += `<div class="tf-row" id="tf_${ui}_${li}_${idx}">
            <div class="tf-stmt">${st.s}</div>
            <div class="tf-btns">
              <button class="tf-btn t" onclick="checkTF(${ui},${li},'${idx}',true,${st.ans})">✅ True</button>
              <button class="tf-btn f" onclick="checkTF(${ui},${li},'${idx}',false,${st.ans})">❌ False</button>
            </div>
            <div class="tf-ico" id="tf_ico_${ui}_${li}_${idx}"></div>
          </div>`;
        });
      }
      else if (ex.type === 'scramble') {
        const wordLetters = ex.word.split('');
        let scrambledLetters = [...wordLetters].map((char, index) => ({ char, index }));
        scrambledLetters.sort((a,b) => (a.char.charCodeAt(0) - b.char.charCodeAt(0)) || (a.index - b.index));
        
        html += `
          <div class="scramble-box" id="ex_${ui}_${li}_${ei}">
            <div class="scramble-header">
              <span class="ex-num" style="background:${u.color}">${ei+1}</span>
              <span>${ex.q}</span>
              ${ex.hint ? `<span class="scramble-hint-emoji">${ex.hint}</span>` : ''}
            </div>

            <div class="scramble-slots" id="scr_slots_${ui}_${li}_${ei}">
              ${wordLetters.map(() => `<div class="scramble-slot"></div>`).join('')}
            </div>

            <div class="scramble-letters" id="scr_letters_${ui}_${li}_${ei}">
              ${scrambledLetters.map(item => `
                <button class="scramble-letter-btn scr-lbtn-${ui}-${li}-${ei}"
                  id="scr_btn_${ui}_${li}_${ei}_${item.index}"
                  onclick="makeScrambleGuess(${ui},${li},${ei},'${item.char}',${item.index},'${ex.word}')">
                  ${item.char}
                </button>
              `).join('')}
            </div>

            <div class="scramble-actions">
              <button class="scramble-btn-action reset-btn" id="scr_reset_${ui}_${li}_${ei}" onclick="resetScramble(${ui},${li},${ei})">
                🔄 Clear Spelling
              </button>
            </div>

            <div class="feedback" id="fb_${ui}_${li}_${ei}"></div>
          </div>
        `;
      }
      else if (ex.type === 'blank') {
        const displaySentence = ex.q.replace('___', '<span class="blank-space">___</span>');
        html += `
          <div class="ex-box" id="ex_${ui}_${li}_${ei}">
            <h4 id="blank_sent_${ui}_${li}_${ei}">
              <span class="ex-num" style="background:${u.color}">${ei+1}</span>
              ${displaySentence}
            </h4>
            <div id="blank_opts_${ui}_${li}_${ei}">
              ${ex.opts.map((opt, oi) => `
                <button class="mc-opt" onclick="selectBlankOption(${ui},${li},${ei},${oi},${ex.ans},'${opt}')">
                  <span class="mc-letter">${String.fromCharCode(65+oi)}</span>${opt}
                </button>
              `).join('')}
            </div>
            <div class="feedback" id="fb_${ui}_${li}_${ei}"></div>
          </div>
        `;
      }
    });
  }

  const totalLessons = u.lessons.length;
  html += `<div style="display:flex;justify-content:space-between;margin-top:28px;gap:12px;flex-wrap:wrap;">`;
  if (li > 0) {
    html += `<button onclick="renderLesson(${ui},${li-1})" style="padding:10px 20px;border-radius:99px;border:2px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-family:'Nunito',sans-serif;font-weight:800;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:6px;">◀ Previous</button>`;
  } else {
    html += `<div></div>`;
  }
  if (li < totalLessons - 1) {
    html += `<button onclick="renderLesson(${ui},${li+1})" style="padding:10px 22px;border-radius:99px;border:none;background:${u.color};color:#fff;font-family:'Nunito',sans-serif;font-weight:800;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 3px 12px rgba(0,0,0,.2);">Next Lesson ▶</button>`;
  }
  html += `</div>`;

  return html;
}

// ══════════════════════════════════════════════════════════════════
// RESTORE SAVED ANSWERS
// ══════════════════════════════════════════════════════════════════
function restoreAnswers(ui, li) {
  const u = UNITS[ui], l = u.lessons[li];
  if (!l) return;

  if (l.exercises) {
    l.exercises.forEach((ex, ei) => {
      const key = `${ui}-${li}-${ei}`;
      if (STATE.answers[key] !== undefined) {
        const savedVal = STATE.answers[key];

        if (ex.type === 'mc') {
          const chosen = savedVal;
          const box = document.getElementById(`ex_${ui}_${li}_${ei}`);
          const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
          if (!box) return;
          box.dataset.done = '1';
          const opts = box.querySelectorAll('.mc-opt');
          opts.forEach((o, i) => {
            o.disabled = true;
            if (i === ex.ans) {
              o.classList.add('correct');
              const letterEl = o.querySelector('.mc-letter');
              if (letterEl) {
                letterEl.style.background = '#22C55E';
                letterEl.style.color = '#fff';
              }
            }
          });
          if (chosen !== ex.ans) {
            opts[chosen].classList.add('wrong');
            const wl = opts[chosen].querySelector('.mc-letter');
            if (wl) {
              wl.style.background = '#EF4444';
              wl.style.color = '#fff';
            }
            if (fb) {
              fb.textContent = '❌ Not quite! See the correct answer highlighted above.';
              fb.className = 'feedback show bad';
            }
          } else {
            if (fb) {
              fb.textContent = '✅ Excellent! Well done!';
              fb.className = 'feedback show good';
            }
          }
        }
        else if (ex.type === 'blank') {
          const chosenIdx = savedVal;
          const sentenceEl = document.getElementById(`blank_sent_${ui}_${li}_${ei}`);
          const blankSpace = sentenceEl ? sentenceEl.querySelector('.blank-space') : null;
          const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
          const container = document.getElementById(`blank_opts_${ui}_${li}_${ei}`);
          
          if (blankSpace) {
            blankSpace.textContent = ex.opts[chosenIdx];
            blankSpace.classList.add('filled');
          }

          if (container) {
            const buttons = container.querySelectorAll('.mc-opt');
            buttons.forEach((btn, idx) => {
              btn.disabled = true;
              if (idx === ex.ans) {
                btn.classList.add('correct');
                const letter = btn.querySelector('.mc-letter');
                if (letter) letter.style.background = '#22C55E';
              }
            });

            if (chosenIdx === ex.ans) {
              if (blankSpace) blankSpace.classList.add('correct');
              if (fb) {
                fb.textContent = '✅ Fantastic choice!';
                fb.className = 'feedback show good';
              }
            } else {
              if (blankSpace) blankSpace.classList.add('wrong');
              buttons[chosenIdx].classList.add('wrong');
              const wrongLetter = buttons[chosenIdx].querySelector('.mc-letter');
              if (wrongLetter) wrongLetter.style.background = '#EF4444';
              
              if (fb) {
                fb.textContent = `❌ Not quite. The correct sentence is shown above.`;
                fb.className = 'feedback show bad';
              }
            }
          }
        }
        else if (ex.type === 'scramble') {
          const targetWord = ex.word;
          const slots = document.querySelectorAll(`#scr_slots_${ui}_${li}_${ei} .scramble-slot`);
          slots.forEach((slot, sIdx) => {
            slot.textContent = targetWord[sIdx];
            slot.classList.add('correct');
          });

          const buttons = document.querySelectorAll(`.scr-lbtn-${ui}-${li}-${ei}`);
          buttons.forEach(btn => btn.disabled = true);
          const resetBtn = document.getElementById(`scr_reset_${ui}_${li}_${ei}`);
          if (resetBtn) resetBtn.style.display = 'none';

          const fb = document.getElementById(`fb_${ui}_${li}_${ei}`);
          if (fb) {
            fb.textContent = '🎉 Awesome spelling! You unscrambled the word!';
            fb.className = 'feedback show good';
          }
        }
      }
    });
  }

  if (l.tf) {
    l.tf.forEach((t, ti) => {
      const key = `${ui}-${li}-${ti}`;
      if (STATE.tfAnswers[key] !== undefined) {
        const chosen = STATE.tfAnswers[key];
        const row = document.getElementById(`tf_${ui}_${li}_${ti}`);
        const ico = document.getElementById(`tf_ico_${ui}_${li}_${ti}`);
        if (!row) return;
        row.dataset.done = '1';
        const btns = row.querySelectorAll('.tf-btn');
        btns.forEach(b => b.disabled = true);
        row.style.borderColor = chosen === t.ans ? '#22C55E' : '#EF4444';
        if (chosen === t.ans) {
          (chosen ? btns[0] : btns[1]).classList.add('correct');
          if (ico) ico.textContent = '✅';
        } else {
          (chosen ? btns[0] : btns[1]).classList.add('wrong');
          (t.ans ? btns[0] : btns[1]).classList.add('correct');
          if (ico) ico.textContent = '❌';
        }
      }
    });
  }

  if (l.exercises) {
    l.exercises.forEach((ex, ei) => {
      if (ex.type === 'tf') {
        ex.stmts.forEach((st, sti) => {
          const idx = `x${ei}_${sti}`;
          const key = `${ui}-${li}-${idx}`;
          if (STATE.tfAnswers[key] !== undefined) {
            const chosen = STATE.tfAnswers[key];
            const row = document.getElementById(`tf_${ui}_${li}_${idx}`);
            const ico = document.getElementById(`tf_ico_${ui}_${li}_${idx}`);
            if (!row) return;
            row.dataset.done = '1';
            const btns = row.querySelectorAll('.tf-btn');
            btns.forEach(b => b.disabled = true);
            row.style.borderColor = chosen === st.ans ? '#22C55E' : '#EF4444';
            if (chosen === st.ans) {
              (chosen ? btns[0] : btns[1]).classList.add('correct');
              if (ico) ico.textContent = '✅';
            } else {
              (chosen ? btns[0] : btns[1]).classList.add('wrong');
              (st.ans ? btns[0] : btns[1]).classList.add('correct');
              if (ico) ico.textContent = '❌';
            }
          }
        });
      }
    });
  }

  updateUnitTabProgress();
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildApp();
  
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel) {
    statsPanel.addEventListener('click', e => {
      if (e.target === statsPanel) closeStats();
    });
  }

  const resourcesPanel = document.getElementById('resourcesPanel');
  if (resourcesPanel) {
    resourcesPanel.addEventListener('click', e => {
      if (e.target === resourcesPanel) closeResources();
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// APP MODES MANAGEMENT (Lessons, Digital Student Book, Workbook, Tests)
// ══════════════════════════════════════════════════════════════════

let bookInitialized = false;
let wbInitialized = false;
let testsInitialized = false;

let currentBookUnit = STATE.bookUnit || 0;
let currentBookPageIdx = STATE.bookPageIdx || 0;
let currentWbUnit = STATE.workbookUnit || 0;
let currentTestUnit = STATE.testUnit || 0;

let bookPlayer = new Audio();
let currentBookTrackBtn = null;

let testPlayer = new Audio();
let testPlayBtn = null;

function initAppModes() {
  const tabsWrap = document.getElementById('appModeTabs');
  if (!tabsWrap) return;
  tabsWrap.querySelectorAll('.am-tab').forEach(btn => {
    btn.onclick = () => switchAppMode(btn.dataset.mode);
  });
  updateAppModeTabsUI();
}

function updateAppModeTabsUI() {
  const tabsWrap = document.getElementById('appModeTabs');
  if (!tabsWrap) return;
  tabsWrap.querySelectorAll('.am-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === (STATE.appMode || 'lessons'));
  });
}

function switchAppMode(mode) {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
    activeAudioId = null;
  }
  stopBookAudio();
  stopTestAudio();
  
  STATE.appMode = mode;
  saveState();
  updateAppModeTabsUI();
  
  const rootUnit = document.getElementById('rootUnitSelector');
  const rootLesson = document.getElementById('rootLessonSelector');
  
  if (mode === 'lessons') {
    if (rootUnit) rootUnit.style.display = 'block';
    if (rootLesson) rootLesson.style.display = 'block';
    buildUnitTabs();
    renderUnit(currentUnit, currentLesson);
  } else {
    if (rootUnit) rootUnit.style.display = 'none';
    if (rootLesson) rootLesson.style.display = 'none';
    
    if (mode === 'book') {
      initBook();
    } else if (mode === 'workbook') {
      initWorkbook();
    } else if (mode === 'tests') {
      initTests();
    }
  }
  updateOverviewBar();
}

// ══════════════════════════════════════════════════════════════════
// DIGITAL STUDENT BOOK MODE
// ══════════════════════════════════════════════════════════════════

function initBook() {
  bookInitialized = true;
  const main = document.getElementById('mainContent');
  if (!main) return;
  
  main.innerHTML = `
    <nav class="unit-nav" style="border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <div class="unit-tabs" id="bookUnitTabs"></div>
    </nav>
    <div class="lesson-wrap" style="padding-top: 0;">
      <div class="unit-title-row" style="display: flex; align-items: center; gap: 16px; margin-bottom: 22px;">
        <div class="unit-icon" id="bookUnitIcon" style="width: 58px; height: 58px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-family: 'Fredoka One', cursive; font-size: 1.7rem; color: #fff; box-shadow: 0 6px 0 rgba(0,0,0,.12);"></div>
        <div>
          <h2 id="bookUnitTitle" style="font-family: 'Fredoka One', cursive; font-size: 1.6rem; color: var(--text-primary);"></h2>
          <p id="bookUnitTopic" style="color: var(--text-secondary); font-size: .85rem; font-weight: 700; margin-top: 2px;"></p>
        </div>
      </div>
      
      <div class="reader">
        <button class="nav-arrow prev" id="bookPrevBtn" title="Previous page (←)">‹</button>
        <div class="reader-split" id="bookReaderSplit">
          <div class="page-stage">
            <button class="btn-toggle-img" id="toggleBookImageBtn" onclick="toggleBookImage()" style="margin-bottom: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📖 Hide Page Image
            </button>
            <div class="page-frame" id="bookPageFrame" style="width: 100%; max-width: 640px; border-radius: 10px; overflow: hidden; position: relative; background: #fff; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);">
              <div class="ph" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #D8CDB4; font-size: 2rem;">📖</div>
              <img id="bookPageImg" alt="Book page" style="display: block; width: 100%; height: auto;">
              <button class="nav-arrow mobile-show prev" id="bookPrevBtnM">‹</button>
              <button class="nav-arrow mobile-show next" id="bookNextBtnM">›</button>
            </div>
            <div class="page-meta" style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 640px; margin-top: 12px; flex-wrap: wrap; gap: 10px;">
              <div class="page-counter" style="font-weight: 800; font-size: .82rem; color: var(--text-secondary);">Page <b id="bookPageIdx" style="color: var(--text-primary);">1</b> of <b id="bookPageTotal">12</b></div>
              <div id="bookInteractiveBtnWrap" style="display:none;"></div>
              <div class="book-page-num" id="bookPageNum" style="background: var(--text-primary); color: var(--bg); font-family: 'Fredoka One', cursive; font-size: .78rem; padding: 4px 12px; border-radius: 8px;">p. 6</div>
            </div>
            
            <div class="audio-strip">
              <div class="audio-strip-label">🔊 Tracks</div>
              <div class="track-btns" id="bookTrackBtns"></div>
            </div>
            
            <div class="thumb-strip" id="bookThumbStrip"></div>
            <div class="kbd-hint" style="text-align: center; color: var(--text-secondary); font-size: .74rem; font-weight: 700; margin-top: 6px;">Use <kbd>←</kbd> <kbd>→</kbd> arrow keys to turn pages</div>
          </div>
          <div class="book-interactive-pane" id="bookInteractivePane"></div>
        </div>
        <button class="nav-arrow next" id="bookNextBtn" title="Next page (→)">›</button>
      </div>
    </div>
  `;
  buildBookUnitTabs();
  renderBookUnit();
  
  // Wire controls
  document.getElementById('bookPrevBtn').onclick = goBookPrev;
  document.getElementById('bookNextBtn').onclick = goBookNext;
  document.getElementById('bookPrevBtnM').onclick = goBookPrev;
  document.getElementById('bookNextBtnM').onclick = goBookNext;
}

function buildBookUnitTabs() {
  const wrap = document.getElementById('bookUnitTabs');
  if (!wrap) return;
  wrap.innerHTML = '';
  BOOK_UNITS.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.className = 'utab' + (i === currentBookUnit ? ' active' : '');
    const badge = u.num === 'S' ? '★' : u.num;
    const label = u.num === 'S' ? 'Starter' : `Unit ${u.num}`;
    btn.innerHTML = `<span class="ubadge" style="background:${u.color}; width:24px; height:24px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; font-family:'Fredoka One',cursive; font-size:.78rem; color:#fff; margin-right:6px;">${badge}</span>${label}`;
    btn.onclick = () => {
      currentBookUnit = i;
      currentBookPageIdx = 0;
      STATE.bookUnit = i;
      STATE.bookPageIdx = 0;
      saveState();
      renderBookUnit();
    };
    wrap.appendChild(btn);
  });
}

function renderBookUnit() {
  document.querySelectorAll('#bookUnitTabs .utab').forEach((b, i) => b.classList.toggle('active', i === currentBookUnit));
  const u = BOOK_UNITS[currentBookUnit];
  const icon = document.getElementById('bookUnitIcon');
  if (icon) {
    icon.style.background = u.color;
    icon.textContent = u.num === 'S' ? '★' : u.num;
  }
  const title = document.getElementById('bookUnitTitle');
  if (title) title.textContent = u.title;
  const topic = document.getElementById('bookUnitTopic');
  if (topic) topic.textContent = u.topic;
  
  renderBookPage();
}

function renderBookPage() {
  stopBookAudio();
  const u = BOOK_UNITS[currentBookUnit];
  const page = u.pages[currentBookPageIdx];
  if (!page) return;
  
  const img = document.getElementById('bookPageImg');
  const frame = document.getElementById('bookPageFrame');
  const loader = frame.querySelector('.ph');
  
  if (img) {
    img.classList.remove('loaded');
    if (loader) loader.style.display = 'flex';
    img.onload = () => {
      img.classList.add('loaded');
      if (loader) loader.style.display = 'none';
    };
    img.onerror = () => {
      if (loader) {
        loader.textContent = '⚠️ Failed to load page';
        loader.style.display = 'flex';
      }
    };
    img.src = `Student Book/images/${page.file}`;
  }
  
  const pageIdxEl = document.getElementById('bookPageIdx');
  if (pageIdxEl) pageIdxEl.textContent = currentBookPageIdx + 1;
  const pageTotalEl = document.getElementById('bookPageTotal');
  if (pageTotalEl) pageTotalEl.textContent = u.pages.length;
  const pageNumEl = document.getElementById('bookPageNum');
  if (pageNumEl) pageNumEl.textContent = `p. ${page.page}`;

  const wrap = document.getElementById('bookInteractiveBtnWrap');
  if (wrap) wrap.innerHTML = '';
  
  const pane = document.getElementById('bookInteractivePane');
  if (pane) {
    pane.innerHTML = '';
    const lessonIdx = findLessonForPage(currentBookUnit, page);
    if (lessonIdx !== -1) {
      const lu = UNITS[currentBookUnit];
      const l = lu.lessons[lessonIdx];
      pane.innerHTML = `
        <div class="lesson-wrap" style="padding:0; margin:0; box-shadow:none; border:none; background:transparent;">
          ${buildLessonHTML(lu, l, currentBookUnit, lessonIdx)}
        </div>
      `;
      restoreAnswers(currentBookUnit, lessonIdx);
    } else {
      pane.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary); background: var(--bg-card); border-radius: var(--radius); border: 1px dashed var(--border); font-weight: 700; display: flex; flex-direction: column; align-items: center; gap: 10px; height: 100%; justify-content: center; min-height: 250px;">
          <span style="font-size: 2rem;">📖</span>
          <span style="font-size: 0.95rem; font-family: 'Fredoka One', cursive;">Textbook Page</span>
          <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.85; max-width: 280px; line-height: 1.4;">No interactive exercises are mapped directly to this page. Use the Unit selector or thumbnail strip to browse other pages.</span>
        </div>
      `;
    }
  }

  // Audio tracks
  const trackBtns = document.getElementById('bookTrackBtns');
  if (trackBtns) {
    trackBtns.innerHTML = '';
    if (page.tracks && page.tracks.length) {
      page.tracks.forEach(track => {
        const btn = document.createElement('button');
        btn.className = 'track-btn';
        btn.innerHTML = `▶ <span class="ic">Track ${track}</span>`;
        btn.dataset.track = track;
        btn.dataset.unit = page.unit;
        btn.onclick = () => playBookTrack(page.unit, track, btn);
        trackBtns.appendChild(btn);
      });
    } else {
      trackBtns.innerHTML = '<span class="no-tracks">No audio tracks for this page</span>';
    }
  }
  
  // Thumbnails
  const thumbStrip = document.getElementById('bookThumbStrip');
  if (thumbStrip) {
    thumbStrip.innerHTML = '';
    u.pages.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'thumb' + (idx === currentBookPageIdx ? ' active' : '');
      div.innerHTML = `<img src="Student Book/images/${p.file}" loading="lazy"><span class="tnum">${p.page}</span>`;
      div.onclick = () => {
        currentBookPageIdx = idx;
        STATE.bookPageIdx = idx;
        saveState();
        renderBookPage();
      };
      thumbStrip.appendChild(div);
    });
    const activeThumb = thumbStrip.children[currentBookPageIdx];
    if (activeThumb) {
      thumbStrip.scrollTo({
        left: activeThumb.offsetLeft - thumbStrip.offsetWidth / 2 + activeThumb.offsetWidth / 2,
        behavior: 'smooth'
      });
    }
  }
  
  // Disable arrows
  const prevBtn = document.getElementById('bookPrevBtn');
  const nextBtn = document.getElementById('bookNextBtn');
  const prevBtnM = document.getElementById('bookPrevBtnM');
  const nextBtnM = document.getElementById('bookNextBtnM');
  
  const isFirst = (currentBookUnit === 0 && currentBookPageIdx === 0);
  const isLast = (currentBookUnit === BOOK_UNITS.length - 1 && currentBookPageIdx === u.pages.length - 1);
  
  if (prevBtn) prevBtn.disabled = isFirst;
  if (prevBtnM) prevBtnM.disabled = isFirst;
  if (nextBtn) nextBtn.disabled = isLast;
  if (nextBtnM) nextBtnM.disabled = isLast;
}

function goBookPrev() {
  if (STATE.appMode !== 'book') return;
  if (currentBookPageIdx > 0) {
    currentBookPageIdx--;
    STATE.bookPageIdx = currentBookPageIdx;
    saveState();
    renderBookPage();
    return;
  }
  if (currentBookUnit > 0) {
    currentBookUnit--;
    currentBookPageIdx = BOOK_UNITS[currentBookUnit].pages.length - 1;
    STATE.bookUnit = currentBookUnit;
    STATE.bookPageIdx = currentBookPageIdx;
    saveState();
    buildBookUnitTabs();
    renderBookUnit();
  }
}

function goBookNext() {
  if (STATE.appMode !== 'book') return;
  const u = BOOK_UNITS[currentBookUnit];
  if (currentBookPageIdx < u.pages.length - 1) {
    currentBookPageIdx++;
    STATE.bookPageIdx = currentBookPageIdx;
    saveState();
    renderBookPage();
    return;
  }
  if (currentBookUnit < BOOK_UNITS.length - 1) {
    currentBookUnit++;
    currentBookPageIdx = 0;
    STATE.bookUnit = currentBookUnit;
    STATE.bookPageIdx = 0;
    saveState();
    buildBookUnitTabs();
    renderBookUnit();
  }
}

function getBookAudioUrl(unit, track) {
  const t = String(track).padStart(3, '0');
  if (unit === 'ST') return `audio/beehive2-unit-ST-track-${t}.mp3`;
  if (unit === 'EXT') return `audio/beehive2-Extensive-reading-track-${t}.mp3`;
  return `audio/beehive2-unit-${unit}-track-${t}.mp3`;
}

function playBookTrack(unit, track, btn) {
  const src = getBookAudioUrl(unit, track);
  if (currentBookTrackBtn === btn) {
    stopBookAudio();
    return;
  }
  stopBookAudio();
  
  btn.dataset.label = btn.innerHTML;
  bookPlayer.src = src;
  bookPlayer.play().catch(() => {
    btn.innerHTML = `<span class="ic">⚠️</span> Track ${String(track).padStart(3, '0')} (missing)`;
    setTimeout(() => { btn.innerHTML = btn.dataset.label; }, 2000);
  });
  btn.innerHTML = `<span class="ic">⏸</span> Track ${String(track).padStart(3, '0')}`;
  btn.classList.add('playing');
  currentBookTrackBtn = btn;
  bookPlayer.onended = () => stopBookAudio();
  
  // Stats increment
  STATE.audioPlayed = (STATE.audioPlayed || 0) + 1;
  saveState();
}

function stopBookAudio() {
  bookPlayer.pause();
  bookPlayer.currentTime = 0;
  if (currentBookTrackBtn) {
    currentBookTrackBtn.classList.remove('playing');
    currentBookTrackBtn.innerHTML = currentBookTrackBtn.dataset.label || `▶ <span class="ic">Track ${currentBookTrackBtn.dataset.track}</span>`;
  }
  currentBookTrackBtn = null;
}

// Add arrow keys turning pages
document.addEventListener('keydown', e => {
  if (STATE.appMode === 'book') {
    if (e.key === 'ArrowLeft') goBookPrev();
    if (e.key === 'ArrowRight') goBookNext();
  }
});

// ══════════════════════════════════════════════════════════════════
// INTERACTIVE WORKBOOK MODE
// ══════════════════════════════════════════════════════════════════

function getWbAns(unitIdx, exKey) {
  STATE.wbAnswers[unitIdx] = STATE.wbAnswers[unitIdx] || {};
  STATE.wbAnswers[unitIdx][exKey] = STATE.wbAnswers[unitIdx][exKey] || {};
  return STATE.wbAnswers[unitIdx][exKey];
}

function initWorkbook() {
  wbInitialized = true;
  const main = document.getElementById('mainContent');
  if (!main) return;
  
  main.innerHTML = `
    <nav class="unit-nav" style="border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <div class="unit-tabs" id="wbUnitTabs"></div>
    </nav>
    <main class="main" id="wbMain" style="padding: 0; max-width: 100%;"></main>
  `;
  
  buildWbUnitTabs();
  renderWbUnit();
}

function buildWbUnitTabs() {
  const wrap = document.getElementById('wbUnitTabs');
  if (!wrap) return;
  wrap.innerHTML = '';
  WB_UNITS.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.className = 'utab' + (i === currentWbUnit ? ' active' : '');
    const badge = u.num === 0 ? '★' : u.num;
    const label = u.num === 0 ? 'Starter' : `Unit ${u.num}`;
    btn.innerHTML = `<span class="ubadge" style="background:${u.color}; width:24px; height:24px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; font-family:'Fredoka One',cursive; font-size:.78rem; color:#fff; margin-right:6px;">${badge}</span>${label} Workbook`;
    btn.onclick = () => {
      currentWbUnit = i;
      STATE.workbookUnit = i;
      saveState();
      renderWbUnit();
    };
    wrap.appendChild(btn);
  });
}

function renderWbUnit() {
  document.querySelectorAll('#wbUnitTabs .utab').forEach((b, i) => b.classList.toggle('active', i === currentWbUnit));
  const u = WB_UNITS[currentWbUnit];
  const main = document.getElementById('wbMain');
  if (!main) return;
  const checked = !!STATE.wbChecked[currentWbUnit];
  const badge = u.num === 0 ? '★' : u.num;

  let html = `
    <div class="test-head">
      <div class="test-head-left">
        <div class="unit-icon" style="background:${u.color}; width:58px; height:58px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-family:'Fredoka One',cursive; font-size:1.7rem; color:#fff; box-shadow: 0 6px 0 rgba(0,0,0,.12);">${badge}</div>
        <div>
          <h2 style="font-family:'Fredoka One',cursive;font-size:1.4rem; color: var(--text-primary);">${escapeHtml(u.title)} — Workbook</h2>
          <p style="color:var(--text-secondary);font-size:.82rem;font-weight:700;">${u.exercises.length} exercises · ${u.pages.length} pages</p>
        </div>
      </div>
      <div class="test-actions">
        <button class="btn btn-ghost" id="wbResetBtn">↺ Reset</button>
        <button class="btn btn-primary" id="wbCheckBtn">✓ Check answers</button>
      </div>
    </div>
  `;

  if (checked) {
    const {earned, max} = scoreWbUnit(currentWbUnit);
    const pct = max ? earned / max : 0;
    let cls = 'retry', emoji = '🐝', msg = 'Keep practising!';
    if (pct >= .85) { cls = 'celebrate'; emoji = '🎉'; msg = 'Excellent work!'; }
    else if (pct >= .6) { cls = 'ok'; emoji = '👍'; msg = 'Good job! Keep going.'; }
    html += `
      <div class="results-banner ${cls}">
        <div class="results-emoji">${emoji}</div>
        <div class="results-text">
          <strong>${earned} / ${max} (auto-graded)</strong>
          <span>${msg} Personal &amp; creative activities aren't graded.</span>
        </div>
      </div>
    `;
  }

  const lessons = [];
  u.exercises.forEach(ex => { if (!lessons.includes(ex.lesson)) lessons.push(ex.lesson); });

  lessons.forEach(lesson => {
    const lessonExs = u.exercises.filter(e => e.lesson === lesson);
    const pages = [...new Set(lessonExs.map(e => e.page))];
    
    const firstPageUrl = pages[0];
    const pageIndexInWb = u.pages.indexOf(firstPageUrl);
    let bookPageLinkBtn = '';
    if (pageIndexInWb !== -1 && BOOK_UNITS[currentWbUnit] && BOOK_UNITS[currentWbUnit].pages[pageIndexInWb]) {
      const studentBookPageNum = BOOK_UNITS[currentWbUnit].pages[pageIndexInWb].page;
      bookPageLinkBtn = `
        <button class="btn btn-ghost" onclick="jumpToBookPage(${currentWbUnit}, ${pageIndexInWb})" style="padding: 4px 10px; font-size: 0.72rem; border-color: var(--orange); color: var(--text-primary); margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;">
          📖 Student Book (p. ${studentBookPageNum})
        </button>
      `;
    }

    html += `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 22px 0 10px;">
        <div class="lesson-badge" style="margin:0;">${escapeHtml(lesson)}</div>
        ${bookPageLinkBtn}
        <button class="btn btn-ghost btn-toggle-img" onclick="toggleWbImage(this)" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
          📖 Hide Page Image
        </button>
      </div>
    `;
    html += `<div class="test-page-block">`;
    html += `<div class="test-page-img-wrap">`;
    pages.forEach(p => {
      html += `<img src="${p}" loading="lazy" alt="${escapeHtml(lesson)}">`;
    });
    html += `</div>`;
    html += `<div class="test-sections">`;
    lessonExs.forEach(ex => {
      html += renderWbEx(u, ex, checked);
    });
    html += `</div></div>`;
  });

  main.innerHTML = html;

  document.getElementById('wbCheckBtn').onclick = () => {
    STATE.wbChecked[currentWbUnit] = true;
    const {earned} = scoreWbUnit(currentWbUnit);
    STATE.score = (STATE.score || 0) + (earned * 5);
    saveState();
    renderWbUnit();
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
  
  document.getElementById('wbResetBtn').onclick = () => {
    delete STATE.wbAnswers[currentWbUnit];
    delete STATE.wbChecked[currentWbUnit];
    saveState();
    renderWbUnit();
  };
  
  wireWbInputs(checked);
}

function renderWbEx(u, ex, checked) {
  const key = ex.lesson + '_' + ex.exnum;
  const isPersonal = ex.type === 'personal';
  let h = `<div class="sec-block" data-exkey="${key}">`;
  if (isPersonal) h += `<span class="ungraded-tag" style="float:right;background:var(--text-secondary);">personal</span>`;
  h += `<div class="sec-instr"><span class="secnum">${ex.exnum}.</span> ${escapeHtml(ex.instruction)}</div>`;
  if (ex.note) h += `<div class="sec-context">💡 ${escapeHtml(ex.note)}</div>`;

  if (ex.wordBank) {
    h += `<div class="word-bank">` + ex.wordBank.map(w => `<span class="wb-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</span>`).join('') + `</div>`;
  }

  if (ex.type === 'crossword') {
    h += renderWbCrossword(ex, key, checked);
    h += `</div>`;
    return h;
  }
  if (ex.type === 'word-order') {
    h += renderWbWordOrder(ex, key, checked);
    h += `</div>`;
    return h;
  }

  h += `<div class="items">`;
  ex.items.forEach((it, idx) => {
    h += renderWbItem(ex, key, it, idx, checked);
  });
  h += `</div></div>`;
  return h;
}

function renderWbCrossword(ex, key, checked) {
  const ans = getWbAns(currentWbUnit, key);
  let h = '<div class="crossword-area">';
  ex.items.forEach((row, idx) => {
    const stored = ans[idx] || '';
    let cells = '';
    for (let i = 0; i < row.word.length; i++) {
      const isSecret = i === row.secretIdx;
      const ch = stored[i] || '';
      let cls = 'cw-cell';
      if (isSecret) cls += ' cw-secret-col';
      if (checked) {
        const correct = (row.word[i] || '').toUpperCase();
        if (ch && ch.toUpperCase() === correct) cls += ' correct';
        else if (ch) cls += ' incorrect';
      }
      cells += `<input maxlength="1" class="${cls}" data-key="${key}" data-idx="${idx}" data-pos="${i}" data-kind="cw-cell" value="${escapeHtml(ch)}" ${checked ? 'disabled' : ''}>`;
    }
    h += `<div class="crossword-row">
      <div class="cw-pic-label">${idx + 1}</div>
      <div class="crossword-cells">${cells}</div>
      ${checked ? `<span class="txt-answer-hint" style="margin-left: 8px;">✓ ${row.word}</span>` : ''}
    </div>`;
  });
  h += '</div>';
  
  const secretStored = ans.secret || '';
  let sCls = '';
  if (checked) sCls = normText(secretStored) === normText(ex.secretWord) ? 'correct' : 'incorrect';
  h += `
    <div class="secret-word-box">
      <label>🐝 The secret word is S</label>
      <input class="txt-input ${sCls}" style="max-width:180px;text-transform:uppercase;" data-key="${key}" data-idx="secret" data-kind="cw-secret" value="${escapeHtml(secretStored.replace(/^[Ss]/, ''))}" ${checked ? 'disabled' : ''} placeholder="___">
      ${checked && sCls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${ex.secretWord}</span>` : ''}
    </div>
  `;
  return h;
}

function renderWbWordOrder(ex, key, checked) {
  const ans = getWbAns(currentWbUnit, key);
  let h = '';
  ex.items.forEach((it, idx) => {
    const sentVal = (ans[idx] && ans[idx].sentence) || '';
    const speakerVal = (ans[idx] && ans[idx].speaker) || '';
    let sCls = '', spCls = '';
    if (checked) {
      sCls = normStrict(sentVal) === normStrict(it.answer) ? 'correct' : 'incorrect';
      spCls = (speakerVal === String(it.character)) ? 'correct' : 'incorrect';
    }
    const chips = it.words.map(w => `<span class="wb-chip" style="cursor:default;">${escapeHtml(w)}</span>`).join('');
    let opts = `<option value="">Who says it?</option>` + (ex.characters || []).map((c, ci) => `<option value="${ci + 1}" ${speakerVal === String(ci + 1) ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    h += `
      <div class="item-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${chips}</div>
        <div class="item-controls" style="width: 100%; display: flex; gap: 8px;">
          <input class="txt-input ${sCls}" style="flex:1;min-width:220px;" type="text" data-key="${key}" data-idx="${idx}" data-kind="wb-sentence" value="${escapeHtml(sentVal)}" ${checked ? 'disabled' : ''} placeholder="Order the words and write the sentence…">
          <select class="sel-input ${spCls}" data-key="${key}" data-idx="${idx}" data-kind="wb-speaker" ${checked ? 'disabled' : ''}>${opts}</select>
        </div>
        ${checked && sCls === 'incorrect' ? `<div class="txt-answer-hint">correct: ${escapeHtml(it.answer)}</div>` : ''}
      </div>
    `;
  });
  return h;
}

function renderWbItem(ex, key, it, idx, checked) {
  const ans = getWbAns(currentWbUnit, key);
  const stored = ans[idx];

  if (ex.type === 'personal') {
    const val = stored || '';
    return `
      <div class="item-row">
        <div class="item-prompt">📝 ${escapeHtml(it.prompt)}</div>
        <div class="item-controls" style="flex:1;">
          <input class="txt-input" type="text" data-key="${key}" data-idx="${idx}" data-kind="wb-personal" value="${escapeHtml(val)}" placeholder="your answer (not graded)">
        </div>
      </div>
    `;
  }

  if (ex.type === 'choice') {
    const optsHtml = it.options.map((opt, oi) => {
      let cls = (stored === oi) ? 'selected' : '';
      if (checked) {
        if (oi === it.correct) cls += ' reveal-correct';
        else if (stored === oi) cls = 'selected incorrect';
      }
      return `<button class="pill-opt ${cls}" data-key="${key}" data-idx="${idx}" data-oi="${oi}" data-kind="wb-choice" ${checked ? 'disabled' : ''}>${escapeHtml(opt)}</button>`;
    }).join('');
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls">${optsHtml}</div>
      </div>
    `;
  }

  if (ex.type === 'tf') {
    const optsHtml = ['T', 'F'].map(opt => {
      let cls = (stored === opt) ? 'selected' : '';
      if (checked) {
        if (opt === it.answer) cls += ' reveal-correct';
        else if (stored === opt) cls = 'selected incorrect';
      }
      return `<button class="pill-opt ${cls}" data-key="${key}" data-idx="${idx}" data-oi="${opt}" data-kind="wb-tf" ${checked ? 'disabled' : ''}>${opt === 'T' ? 'True' : 'False'}</button>`;
    }).join('');
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls">${optsHtml}</div>
      </div>
    `;
  }

  if (ex.type === 'odd-one-out') {
    const optsHtml = it.words.map(w => {
      let cls = (stored === w) ? 'selected' : '';
      if (checked) {
        if (w === it.odd) cls += ' reveal-correct';
        else if (stored === w) cls = 'selected incorrect';
      }
      return `<button class="pill-opt ${cls}" data-key="${key}" data-idx="${idx}" data-oi="${escapeHtml(w)}" data-kind="wb-odd" ${checked ? 'disabled' : ''}>${escapeHtml(w)}</button>`;
    }).join('');
    return `
      <div class="item-row" style="flex-wrap:wrap;">
        <div class="item-controls" style="flex-wrap:wrap;">${optsHtml}</div>
        ${checked && stored !== it.odd ? `<span class="txt-answer-hint">odd one out: ${escapeHtml(it.odd)}</span>` : ''}
      </div>
    `;
  }

  if (ex.type === 'number-match') {
    let opts = `<option value="">–</option>`;
    for (let n = 1; n <= 8; n++) opts += `<option value="${n}" ${stored == n ? 'selected' : ''}>${n}</option>`;
    let cls = '';
    if (checked && stored) cls = (Number(stored) === it.answer) ? 'correct' : 'incorrect';
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.label)}</div>
        <div class="item-controls">
          <select class="sel-input ${cls}" data-key="${key}" data-idx="${idx}" data-kind="wb-numsel" ${checked ? 'disabled' : ''}>${opts}</select>
          ${checked && cls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${it.answer}</span>` : ''}
        </div>
      </div>
    `;
  }

  if (ex.type === 'tick-write') {
    let cls = '';
    if (checked) {
      const norm = normText(stored || '');
      cls = normText(it.answer) === norm ? 'correct' : 'incorrect';
    }
    return `
      <div class="item-row">
        <div class="item-prompt">
          <span style="font-size:1.1rem;margin-right:8px;">${it.tick === '✔' ? '✔️' : '✖️'}</span>
          ${escapeHtml(it.prompt)}
        </div>
        <div class="item-controls" style="flex:1;">
          <input class="txt-input ${cls}" type="text" data-key="${key}" data-idx="${idx}" data-kind="wb-text" value="${stored ? escapeHtml(stored) : ''}" ${checked ? 'disabled' : ''} placeholder="write the answer…">
          ${checked && cls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${escapeHtml(it.answer)}</span>` : ''}
        </div>
      </div>
    `;
  }

  if (it.given) {
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt || it.label || '')}</div>
        <div class="item-controls">
          <span class="wb-given-answer">${escapeHtml(it.given)}</span>
          <span class="txt-answer-hint">(example)</span>
        </div>
      </div>
    `;
  }
  
  let cls = '', fb = '';
  if (checked && it.answer) {
    const val = normText(stored || '');
    const answers = Array.isArray(it.answer) ? it.answer : [it.answer];
    const ok = answers.map(a => normText(String(a))).includes(val);
    cls = ok ? 'correct' : 'incorrect';
    fb = ok ? `<span class="txt-feedback">✓</span>` : `<span class="txt-feedback bad">✗</span>`;
  }
  return `
    <div class="item-row">
      <div class="item-prompt">${escapeHtml(it.prompt || it.label || '')}</div>
      <div class="item-controls" style="flex:1;min-width:200px;">
        <input class="txt-input ${cls}" type="text" data-key="${key}" data-idx="${idx}" data-kind="wb-text" value="${stored ? escapeHtml(stored) : ''}" ${checked && it.answer ? 'disabled' : ''} placeholder="type your answer…">
        ${fb}
        ${checked && cls === 'incorrect' ? `<div class="txt-answer-hint">correct: ${escapeHtml(Array.isArray(it.answer) ? it.answer[0] : String(it.answer || ''))}</div>` : ''}
      </div>
    </div>
  `;
}

function wireWbInputs(checked) {
  const main = document.getElementById('wbMain');
  if (!main) return;
  
  main.querySelectorAll('[data-kind="wb-text"],[data-kind="wb-personal"]').forEach(inp => {
    inp.oninput = () => {
      getWbAns(currentWbUnit, inp.dataset.key)[+inp.dataset.idx] = inp.value;
      saveState();
    };
  });
  
  main.querySelectorAll('[data-kind="wb-numsel"],[data-kind="wb-sentence"],[data-kind="wb-speaker"]').forEach(el => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const ans = getWbAns(currentWbUnit, el.dataset.key);
      const idx = el.dataset.idx === 'secret' ? 'secret' : +el.dataset.idx;
      if (el.dataset.kind === 'wb-speaker' || el.dataset.kind === 'wb-sentence') {
        ans[idx] = ans[idx] || {};
        if (el.dataset.kind === 'wb-speaker') ans[idx].speaker = el.value;
        else ans[idx].sentence = el.value;
      } else {
        ans[idx] = el.value;
      }
      saveState();
    });
  });
  
  main.querySelectorAll('[data-kind="wb-choice"]').forEach(btn => {
    btn.onclick = () => {
      getWbAns(currentWbUnit, btn.dataset.key)[+btn.dataset.idx] = +btn.dataset.oi;
      saveState();
      renderWbUnit();
    };
  });
  
  main.querySelectorAll('[data-kind="wb-tf"],[data-kind="wb-odd"]').forEach(btn => {
    btn.onclick = () => {
      getWbAns(currentWbUnit, btn.dataset.key)[btn.dataset.oi ? btn.dataset.idx : +btn.dataset.idx] = btn.dataset.oi;
      saveState();
      renderWbUnit();
    };
  });
  
  main.querySelectorAll('[data-kind="cw-cell"]').forEach(inp => {
    inp.oninput = () => {
      inp.value = inp.value.toUpperCase().slice(0, 1);
      const ans = getWbAns(currentWbUnit, inp.dataset.key);
      const idx = +inp.dataset.idx, pos = +inp.dataset.pos;
      let arr = (ans[idx] || '').split('');
      while(arr.length <= pos) arr.push(' ');
      arr[pos] = inp.value;
      ans[idx] = arr.join('');
      saveState();
      
      const next = inp.nextElementSibling;
      if (inp.value && next) next.focus();
    };
  });
  
  main.querySelectorAll('[data-kind="cw-secret"]').forEach(inp => {
    inp.oninput = () => {
      getWbAns(currentWbUnit, inp.dataset.key).secret = 'S' + inp.value.toUpperCase();
      saveState();
    };
  });
  
  main.querySelectorAll('.wb-chip').forEach(chip => {
    chip.onclick = () => {
      if (chip.classList.contains('used')) return;
      const block = chip.closest('.sec-block');
      const inputs = Array.from(block.querySelectorAll('[data-kind="wb-text"]'));
      const target = inputs.find(i => !i.value);
      if (target) {
        target.value = chip.dataset.word;
        target.dispatchEvent(new Event('input'));
        chip.classList.add('used');
      }
    };
  });
}

function scoreWbUnit(unitIdx) {
  const u = WB_UNITS[unitIdx];
  let earned = 0, max = 0;
  u.exercises.forEach(ex => {
    if (ex.type === 'personal') return;
    const key = ex.lesson + '_' + ex.exnum;
    const ans = getWbAns(unitIdx, key);
    
    if (ex.type === 'crossword') {
      ex.items.forEach((row, idx) => {
        max++;
        const stored = ans[idx] || '';
        if (stored.toUpperCase() === row.word.toUpperCase()) earned++;
      });
      max++;
      if (normText(ans.secret || '') === normText(ex.secretWord)) earned++;
    } else if (ex.type === 'word-order') {
      ex.items.forEach((it, idx) => {
        max += 2;
        const val = ans[idx] || {};
        if (normStrict(val.sentence || '') === normStrict(it.answer)) earned++;
        if (val.speaker === String(it.character)) earned++;
      });
    } else {
      ex.items.forEach((it, idx) => {
        if (it.given) return;
        max++;
        const val = ans[idx];
        if (ex.type === 'choice') {
          if (val === it.correct) earned++;
        } else if (ex.type === 'tf') {
          if (val === it.answer) earned++;
        } else if (ex.type === 'odd-one-out') {
          if (val === it.odd) earned++;
        } else if (ex.type === 'number-match') {
          if (val !== undefined && Number(val) === it.answer) earned++;
        } else if (ex.type === 'tick-write') {
          if (val !== undefined && normText(val) === normText(it.answer)) earned++;
        } else {
          if (val !== undefined) {
            const answers = Array.isArray(it.answer) ? it.answer : [it.answer];
            if (answers.map(a => normText(String(a))).includes(normText(val))) earned++;
          }
        }
      });
    }
  });
  return {earned, max};
}

// ══════════════════════════════════════════════════════════════════
// INTERACTIVE TESTS MODE
// ══════════════════════════════════════════════════════════════════

function getTestAns(unitIdx, secId) {
  STATE.testAnswers[unitIdx] = STATE.testAnswers[unitIdx] || {};
  STATE.testAnswers[unitIdx][secId] = STATE.testAnswers[unitIdx][secId] || {};
  return STATE.testAnswers[unitIdx][secId];
}

function initTests() {
  testsInitialized = true;
  const main = document.getElementById('mainContent');
  if (!main) return;
  
  main.innerHTML = `
    <nav class="unit-nav" style="border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <div class="unit-tabs" id="testUnitTabs"></div>
    </nav>
    <main class="main" id="testMain" style="padding: 0; max-width: 100%;"></main>
  `;
  
  buildTestUnitTabs();
  renderTestUnit();
}

function buildTestUnitTabs() {
  const wrap = document.getElementById('testUnitTabs');
  if (!wrap) return;
  wrap.innerHTML = '';
  TESTS.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'utab' + (i === currentTestUnit ? ' active' : '');
    btn.innerHTML = `<span class="ubadge" style="background:${t.color}; width:24px; height:24px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; font-family:'Fredoka One',cursive; font-size:.78rem; color:#fff; margin-right:6px;">${t.num}</span>Unit ${t.num} Test`;
    btn.onclick = () => {
      currentTestUnit = i;
      STATE.testUnit = i;
      saveState();
      renderTestUnit();
    };
    wrap.appendChild(btn);
  });
}

function renderTestUnit() {
  document.querySelectorAll('#testUnitTabs .utab').forEach((b, i) => b.classList.toggle('active', i === currentTestUnit));
  const t = TESTS[currentTestUnit];
  const main = document.getElementById('testMain');
  if (!main) return;
  const checked = !!STATE.testChecked[currentTestUnit];

  let html = `
    <div class="test-head">
      <div class="test-head-left">
        <div class="unit-icon" style="background:${t.color}; width:58px; height:58px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-family:'Fredoka One',cursive; font-size:1.7rem; color:#fff; box-shadow: 0 6px 0 rgba(0,0,0,.12);">${t.num}</div>
        <div>
          <h2 style="font-family:'Fredoka One',cursive;font-size:1.4rem; color: var(--text-primary);">Unit ${t.num} Test: ${escapeHtml(t.title)}</h2>
          <p style="color:var(--text-secondary);font-size:.82rem;font-weight:700;">8 sections · ${t.pages.length} pages</p>
        </div>
      </div>
      <div class="test-actions">
        <button class="btn btn-ghost" id="testResetBtn">↺ Reset</button>
        <button class="btn btn-primary" id="testCheckBtn">✓ Check answers</button>
      </div>
    </div>
  `;

  if (checked) {
    const {earned, max} = scoreTestUnit(currentTestUnit);
    const pct = max ? earned / max : 0;
    let cls = 'retry', emoji = '🐝', msg = 'Keep trying!';
    if (pct >= 0.85) { cls = 'celebrate'; emoji = '🎉'; msg = 'Excellent score! Double high-five!'; }
    else if (pct >= 0.60) { cls = 'ok'; emoji = '👍'; msg = 'Good job! Keep it up.'; }
    html += `
      <div class="results-banner ${cls}">
        <div class="results-emoji">${emoji}</div>
        <div class="results-text">
          <strong>${earned} / ${max} (auto-graded)</strong>
          <span>${msg} Speaking activities are marked manually.</span>
        </div>
      </div>
    `;
    
    if (pct >= 0.85 && typeof confetti === 'function') {
      confetti();
    }
  }

  const pageSecMap = [['v1', 'v2'], ['g3', 'g4'], ['r5', 'w6'], ['l7', 's8']];
  t.pages.forEach((src, pi) => {
    html += `
      <div class="test-page-block">
        <div style="grid-column: span 2; padding: 12px 20px 0; display: flex; justify-content: flex-end;">
          <button class="btn btn-ghost btn-toggle-img" onclick="toggleTestImage(this)" style="padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            📖 Hide Page Image
          </button>
        </div>
        <div class="test-page-img-wrap"><img src="${src}" loading="lazy" alt="Unit ${t.num} test page ${pi + 1}"></div>
        <div class="test-sections">
    `;
    pageSecMap[pi].forEach(secId => {
      const sec = t.sections.find(s => s.id === secId);
      if (sec) html += renderTestSection(t, sec, checked);
    });
    html += `</div></div>`;
  });

  main.innerHTML = html;

  document.getElementById('testCheckBtn').onclick = () => {
    STATE.testChecked[currentTestUnit] = true;
    const {earned} = scoreTestUnit(currentTestUnit);
    STATE.score = (STATE.score || 0) + (earned * 10);
    saveState();
    renderTestUnit();
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
  
  document.getElementById('testResetBtn').onclick = () => {
    delete STATE.testAnswers[currentTestUnit];
    delete STATE.testChecked[currentTestUnit];
    delete STATE.speakDone[currentTestUnit];
    saveState();
    renderTestUnit();
  };

  wireTestSectionInputs(t, checked);
}

function renderTestSection(t, sec, checked) {
  let h = `
    <div class="sec-block" data-secid="${sec.id}">
      <span class="sec-max">/ ${sec.maxScore}</span>
      <div class="sec-instr"><span class="secnum">${sec.num}.</span>${escapeHtml(sec.instruction)}</div>
      <span class="sec-group-badge ${sec.group}">${sec.group}</span>
  `;

  if (sec.passage) h += `<div class="sec-passage">${escapeHtml(sec.passage)}</div>`;
  if (sec.scene) h += `<div class="sec-context">🖼️ ${escapeHtml(sec.scene)}</div>`;
  if (sec.diagram) h += `<div class="sec-context">🖼️ ${escapeHtml(sec.diagram)}</div>`;

  if (sec.type === 'listen') {
    h += `
      <div class="listen-bar">
        <button class="listen-play-btn" data-audio="${t.audio}" data-secid="${sec.id}">▶</button>
        <div class="listen-label">🎧 Listen to the Unit ${t.num} test audio, then choose your answer for each item</div>
      </div>
    `;
  }

  if (sec.wordBank && sec.type === 'text') {
    h += `<div class="word-bank">` + sec.wordBank.map(w => `<span class="wb-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</span>`).join('') + `</div>`;
  }

  h += `<div class="items">`;
  sec.items.forEach((it, idx) => {
    h += renderTestItem(t, sec, it, idx, checked);
  });
  h += `</div></div>`;
  return h;
}

function renderTestItem(t, sec, it, idx, checked) {
  const ans = getTestAns(currentTestUnit, sec.id);
  const stored = ans[idx];

  if (sec.type === 'assign') {
    let opts = `<option value="">–</option>`;
    for (let n = 1; n <= sec.count; n++) opts += `<option value="${n}" ${stored == n ? 'selected' : ''}>${n}</option>`;
    let cls = '';
    if (checked && stored !== undefined && stored !== '') cls = (Number(stored) === it.answer) ? 'correct' : 'incorrect';
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.label)}</div>
        <div class="item-controls">
          <select class="sel-input ${cls}" data-sec="${sec.id}" data-idx="${idx}" data-kind="assign">${opts}</select>
          ${checked && cls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${it.answer}</span>` : ''}
        </div>
      </div>
    `;
  }

  if (sec.type === 'choice') {
    const optsHtml = it.options.map((opt, oi) => {
      let cls = (stored === oi) ? 'selected' : '';
      if (checked) {
        if (oi === it.correct) cls += ' reveal-correct';
        else if (stored === oi) cls = 'selected incorrect';
      }
      return `<button class="pill-opt ${cls}" data-sec="${sec.id}" data-idx="${idx}" data-oi="${oi}" data-kind="choice" ${checked ? 'disabled' : ''}>${escapeHtml(opt)}</button>`;
    }).join('');
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls">${optsHtml}</div>
      </div>
    `;
  }

  if (sec.type === 'text') {
    let cls = '';
    let fb = '';
    if (checked) {
      const val = sec.strict ? normStrict(stored || '') : normText(stored || '');
      const accepted = it.answer.map(a => sec.strict ? normStrict(a) : normText(a));
      const ok = accepted.includes(val);
      cls = ok ? 'correct' : 'incorrect';
      fb = ok ? `<span class="txt-feedback">✓</span>` : `<span class="txt-feedback bad">✗</span>`;
    }
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls" style="flex:1;min-width:220px;">
          <input class="txt-input ${cls}" type="text" data-sec="${sec.id}" data-idx="${idx}" data-kind="text" value="${stored ? escapeHtml(stored) : ''}" ${checked ? 'disabled' : ''} placeholder="type your answer…">
          ${fb}
          ${checked && cls === 'incorrect' ? `<div class="txt-answer-hint">correct: ${escapeHtml(it.answer[0])}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (sec.type === 'match') {
    let opts = `<option value="">–</option>`;
    sec.letters.forEach(L => { opts += `<option value="${L}" ${stored === L ? 'selected' : ''}>${L} — ${escapeHtml(sec.letterText[L])}</option>`; });
    let cls = '';
    if (checked && stored) cls = (stored === it.answer) ? 'correct' : 'incorrect';
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls">
          <select class="sel-input ${cls}" data-sec="${sec.id}" data-idx="${idx}" data-kind="match">${opts}</select>
          ${checked && cls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${it.answer}</span>` : ''}
        </div>
      </div>
    `;
  }

  if (sec.type === 'listen') {
    if (sec.letters) {
      let opts = `<option value="">–</option>`;
      sec.letters.forEach(L => { const letter = L.split(' — ')[0]; opts += `<option value="${letter}" ${stored === letter ? 'selected' : ''}>${escapeHtml(L)}</option>`; });
      let cls = '';
      if (checked && stored) cls = (stored === it.answer) ? 'correct' : 'incorrect';
      return `
        <div class="item-row">
          <div class="item-prompt">${escapeHtml(it.prompt)}</div>
          <div class="item-controls">
            <select class="sel-input ${cls}" data-sec="${sec.id}" data-idx="${idx}" data-kind="listen-select" ${checked ? 'disabled' : ''}>${opts}</select>
            ${checked && cls === 'incorrect' ? `<span class="txt-answer-hint">correct: ${it.answer}</span>` : ''}
          </div>
        </div>
      `;
    }
    const optsHtml = sec.optionSet.map(opt => {
      let cls = (stored === opt) ? 'selected' : '';
      if (checked) {
        if (opt === it.answer) cls += ' reveal-correct';
        else if (stored === opt) cls = 'selected incorrect';
      }
      return `<button class="pill-opt ${cls}" data-sec="${sec.id}" data-idx="${idx}" data-oi="${escapeHtml(opt)}" data-kind="listen-choice" ${checked ? 'disabled' : ''}>${escapeHtml(opt)}</button>`;
    }).join('');
    return `
      <div class="item-row">
        <div class="item-prompt">${escapeHtml(it.prompt)}</div>
        <div class="item-controls">${optsHtml}</div>
      </div>
    `;
  }

  if (sec.type === 'speaking') {
    STATE.speakDone[currentTestUnit] = STATE.speakDone[currentTestUnit] || {};
    STATE.speakDone[currentTestUnit][sec.id] = STATE.speakDone[currentTestUnit][sec.id] || {};
    const done = !!STATE.speakDone[currentTestUnit][sec.id][idx];
    const revealId = `reveal-${sec.id}-${idx}`;
    return `
      <div class="speak-card ${done ? 'done' : ''}">
        <div style="flex:1;">
          <div class="item-prompt">🗣️ ${escapeHtml(it.prompt)}</div>
          ${it.suggested ? `<div class="speak-reveal" id="${revealId}" style="display:none;font-size:.78rem;color:#9C968C;font-weight:700;margin-top:4px;">💡 ${escapeHtml(it.suggested)}</div>` : ''}
        </div>
        ${it.suggested ? `<button class="btn btn-ghost" style="padding:6px 12px;font-size:.72rem;" data-reveal="${revealId}">💡 Show answer</button>` : ''}
        <label class="speak-check"><input type="checkbox" data-sec="${sec.id}" data-idx="${idx}" data-kind="speak" ${done ? 'checked' : ''}> I said it</label>
      </div>
    `;
  }

  return '';
}

function wireTestSectionInputs(t, checked) {
  const main = document.getElementById('testMain');
  if (!main) return;

  main.querySelectorAll('[data-kind="choice"]').forEach(btn => {
    btn.onclick = () => {
      const secId = btn.dataset.sec, idx = +btn.dataset.idx, oi = +btn.dataset.oi;
      getTestAns(currentTestUnit, secId)[idx] = oi;
      saveState();
      renderTestUnit();
    };
  });
  
  main.querySelectorAll('[data-kind="listen-choice"]').forEach(btn => {
    btn.onclick = () => {
      const secId = btn.dataset.sec, idx = +btn.dataset.idx, oi = btn.dataset.oi;
      getTestAns(currentTestUnit, secId)[idx] = oi;
      saveState();
      renderTestUnit();
    };
  });
  
  main.querySelectorAll('[data-kind="assign"], [data-kind="match"], [data-kind="listen-select"]').forEach(sel => {
    sel.onchange = () => {
      const secId = sel.dataset.sec, idx = +sel.dataset.idx;
      getTestAns(currentTestUnit, secId)[idx] = sel.value;
      saveState();
    };
  });
  
  main.querySelectorAll('[data-kind="text"]').forEach(inp => {
    inp.oninput = () => {
      const secId = inp.dataset.sec, idx = +inp.dataset.idx;
      getTestAns(currentTestUnit, secId)[idx] = inp.value;
      saveState();
    };
  });
  
  main.querySelectorAll('[data-kind="speak"]').forEach(cb => {
    cb.onchange = () => {
      const secId = cb.dataset.sec, idx = +cb.dataset.idx;
      STATE.speakDone[currentTestUnit] = STATE.speakDone[currentTestUnit] || {};
      STATE.speakDone[currentTestUnit][secId] = STATE.speakDone[currentTestUnit][secId] || {};
      STATE.speakDone[currentTestUnit][secId][idx] = cb.checked;
      saveState();
      cb.closest('.speak-card').classList.toggle('done', cb.checked);
    };
  });
  
  main.querySelectorAll('[data-reveal]').forEach(btn => {
    btn.onclick = () => {
      const el = document.getElementById(btn.dataset.reveal);
      if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
    };
  });

  main.querySelectorAll('.wb-chip').forEach(chip => {
    chip.onclick = () => {
      if (chip.classList.contains('used')) return;
      const block = chip.closest('.sec-block');
      const inputs = Array.from(block.querySelectorAll('[data-kind="text"]'));
      const target = inputs.find(i => !i.value);
      if (target) {
        target.value = chip.dataset.word;
        target.dispatchEvent(new Event('input'));
        chip.classList.add('used');
      }
    };
  });

  main.querySelectorAll('.listen-play-btn').forEach(btn => {
    btn.onclick = () => toggleTestAudio(btn);
  });
}

function scoreTestUnit(unitIdx) {
  const t = TESTS[unitIdx];
  let earned = 0, max = 0;
  t.sections.forEach(sec => {
    if (sec.type === 'speaking') return;
    max += sec.maxScore;
    const ans = getTestAns(unitIdx, sec.id);
    sec.items.forEach((it, idx) => {
      const val = ans[idx];
      if (sec.type === 'choice') {
        if (val === it.correct) earned++;
      } else if (sec.type === 'assign') {
        if (val !== undefined && Number(val) === it.answer) earned++;
      } else if (sec.type === 'match') {
        if (val === it.answer) earned++;
      } else if (sec.type === 'listen') {
        if (val !== undefined && val === it.answer) earned++;
      } else if (sec.type === 'text') {
        const norm = sec.strict ? normStrict(val || '') : normText(val || '');
        const accepted = it.answer.map(a => sec.strict ? normStrict(a) : normText(a));
        if (val !== undefined && accepted.includes(norm)) earned++;
      }
    });
  });
  return {earned, max};
}

function toggleTestAudio(btn) {
  const src = btn.dataset.audio;
  if (testPlayBtn === btn) { stopTestAudio(); return; }
  stopTestAudio();
  testPlayer.src = src;
  testPlayer.play().catch(() => { btn.textContent = '⚠️'; setTimeout(() => { btn.textContent = '▶'; }, 1800); });
  btn.textContent = '⏸';
  testPlayBtn = btn;
  testPlayer.onended = stopTestAudio;
  
  STATE.audioPlayed = (STATE.audioPlayed || 0) + 1;
  saveState();
}

function stopTestAudio() {
  testPlayer.pause();
  testPlayer.currentTime = 0;
  if (testPlayBtn) testPlayBtn.textContent = '▶';
  testPlayBtn = null;
}

// Helpers
function normText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normStrict(s) {
  return (s || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ══════════════════════════════════════════
// CROSS-LINKING & NAVIGATION JUMPS HELPERS
// ══════════════════════════════════════════

function findLessonForPage(unitIdx, page) {
  const u = UNITS[unitIdx];
  if (!u) return -1;
  const pageTracks = page.tracks || [];
  
  if (pageTracks.length) {
    for (let li = 0; li < u.lessons.length; li++) {
      const lesson = u.lessons[li];
      if (lesson.audio) {
        for (const aud of lesson.audio) {
          const trackNum = parseInt((aud.label || '').replace(/\D/g, ''), 10);
          if (pageTracks.includes(trackNum)) {
            return li;
          }
        }
      }
    }
  }
  
  const pageIndexInUnit = BOOK_UNITS[unitIdx].pages.indexOf(page);
  if (pageIndexInUnit === -1) return -1;
  return Math.min(u.lessons.length - 1, Math.floor(pageIndexInUnit / 2));
}

function findPageForLesson(unitIdx, lesson) {
  const bu = BOOK_UNITS[unitIdx];
  if (!bu) return -1;
  const audioTracks = (lesson.audio || []).map(aud => parseInt((aud.label || '').replace(/\D/g, ''), 10));
  
  if (audioTracks.length) {
    for (let pi = 0; pi < bu.pages.length; pi++) {
      const page = bu.pages[pi];
      if (page.tracks && page.tracks.some(t => audioTracks.includes(t))) {
        return pi;
      }
    }
  }
  
  const lessonIdx = UNITS[unitIdx].lessons.indexOf(lesson);
  if (lessonIdx === -1) return -1;
  return Math.min(bu.pages.length - 1, lessonIdx * 2);
}

function jumpToInteractiveLesson(unitIdx, lessonIdx) {
  currentUnit = unitIdx;
  currentLesson = lessonIdx;
  STATE.lastUnit = unitIdx;
  STATE.lastLesson = lessonIdx;
  STATE.appMode = 'lessons';
  saveState();
  
  updateAppModeTabsUI();
  
  const rootUnit = document.getElementById('rootUnitSelector');
  const rootLesson = document.getElementById('rootLessonSelector');
  if (rootUnit) rootUnit.style.display = 'block';
  if (rootLesson) rootLesson.style.display = 'block';
  
  buildUnitTabs();
  renderUnit(unitIdx, lessonIdx);
  updateOverviewBar();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function toggleWbImage(btn) {
  const header = btn.parentElement;
  if (!header) return;
  const pageBlock = header.nextElementSibling;
  if (pageBlock) {
    const imgWrap = pageBlock.querySelector('.test-page-img-wrap');
    if (imgWrap) {
      const isHidden = imgWrap.style.display === 'none';
      imgWrap.style.display = isHidden ? 'block' : 'none';
      pageBlock.classList.toggle('img-hidden', !isHidden);
      btn.innerHTML = isHidden ? '📖 Hide Page Image' : '📖 Show Page Image';
    }
  }
}

function toggleBookImage() {
  const split = document.getElementById('bookReaderSplit');
  const frame = document.getElementById('bookPageFrame');
  const btn = document.getElementById('toggleBookImageBtn');
  if (split && frame && btn) {
    const isHidden = frame.style.display === 'none';
    frame.style.display = isHidden ? 'block' : 'none';
    split.classList.toggle('img-hidden', !isHidden);
    btn.innerHTML = isHidden ? '📖 Hide Page Image' : '📖 Show Page Image';
  }
}

function toggleTestImage(btn) {
  const pageBlock = btn.closest('.test-page-block');
  if (pageBlock) {
    const imgWrap = pageBlock.querySelector('.test-page-img-wrap');
    if (imgWrap) {
      const isHidden = imgWrap.style.display === 'none';
      imgWrap.style.display = isHidden ? 'block' : 'none';
      pageBlock.classList.toggle('img-hidden', !isHidden);
      btn.innerHTML = isHidden ? '📖 Hide Page Image' : '📖 Show Page Image';
    }
  }
}
