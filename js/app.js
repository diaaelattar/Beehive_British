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
  buildUnitTabs();
  renderUnit(currentUnit, currentLesson);
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
  let html = `
    <div class="unit-hero" style="background:${u.bg}">
      <h2>${u.num === 'S' ? '🌟' : '🐝'} ${u.title}</h2>
      <p>${u.topic}</p>
      <div class="unit-hero-progress">
        <div class="uhp-label"><span>Unit Progress</span><span>${pct}%</span></div>
        <div class="uhp-bar"><div class="uhp-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <h3 style="font-family:'Fredoka One',cursive;font-size:1.35rem;margin-bottom:20px;color:var(--text-primary);">${l.title}</h3>
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
