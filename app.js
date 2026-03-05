// ── State ──────────────────────────────────────────────────────────────────
const DEFAULT_PLAYERS = ['ניר', 'נירה', 'דניאל', 'אופק', 'יפתח'];

const TOPIC_LABELS = {
  football:       '⚽ כדורגל',
  music:          '🎵 מוזיקה',
  tv:             '📺 סדרות',
  musicals:       '🎭 מחזות זמר',
  world_history:  '🌍 היסטוריה עולמית',
  israel_history: '🇮🇱 היסטוריה ישראל',
};

let state = {
  allPlayers: [...DEFAULT_PLAYERS],
  selectedPlayers: [],
  selectedTopics: [],
  questions: [],
  currentIndex: 0,
  scores: {},
  timerInterval: null,
  timeLeft: 10,
  answerRevealed: false,
};

// ── DOM refs ────────────────────────────────────────────────────────────────
const screens = {
  setup:    document.getElementById('screen-setup'),
  loading:  document.getElementById('screen-loading'),
  question: document.getElementById('screen-question'),
  end:      document.getElementById('screen-end'),
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function $(id) { return document.getElementById(id); }

// ── Setup Screen ─────────────────────────────────────────────────────────────
function renderPlayers() {
  const container = $('players-list');
  container.innerHTML = '';
  state.allPlayers.forEach(name => {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (state.selectedPlayers.includes(name) ? ' selected' : '');
    chip.innerHTML = `<span>${name}</span><button class="remove-btn" title="הסר">×</button>`;

    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn')) {
        state.allPlayers = state.allPlayers.filter(p => p !== name);
        state.selectedPlayers = state.selectedPlayers.filter(p => p !== name);
      } else {
        if (state.selectedPlayers.includes(name)) {
          state.selectedPlayers = state.selectedPlayers.filter(p => p !== name);
        } else {
          state.selectedPlayers.push(name);
        }
      }
      renderPlayers();
      updateStartBtn();
    });

    container.appendChild(chip);
  });
}

function updateStartBtn() {
  const btn = $('start-btn');
  const ok = state.selectedPlayers.length >= 1 && state.selectedTopics.length >= 1;
  btn.disabled = !ok;
}

// Topic checkboxes
document.querySelectorAll('#topics-grid input[type=checkbox]').forEach(cb => {
  cb.addEventListener('change', () => {
    state.selectedTopics = Array.from(
      document.querySelectorAll('#topics-grid input:checked')
    ).map(el => el.value);
    updateStartBtn();
  });
});

// Add player
$('add-player-btn').addEventListener('click', addPlayer);
$('new-player-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addPlayer();
});

function addPlayer() {
  const input = $('new-player-input');
  const name = input.value.trim();
  if (!name || state.allPlayers.includes(name)) return;
  state.allPlayers.push(name);
  state.selectedPlayers.push(name);
  input.value = '';
  renderPlayers();
  updateStartBtn();
}

// Start
$('start-btn').addEventListener('click', startGame);

// ── Game Start ───────────────────────────────────────────────────────────────
async function startGame() {
  // Init scores
  state.scores = {};
  state.selectedPlayers.forEach(p => state.scores[p] = 0);
  state.currentIndex = 0;
  state.questions = [];

  showScreen('loading');

  try {
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: state.selectedTopics,
        count: 15,
      }),
    });

    if (!response.ok) throw new Error('שגיאה בשרת');
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) throw new Error('לא התקבלו שאלות');
    state.questions = data;

    showQuestion();
  } catch (err) {
    alert('שגיאה בטעינת שאלות: ' + err.message + '\nבדוק שהשרת רץ ושמפתח ה-API תקין.');
    showScreen('setup');
  }
}

// ── Question Screen ───────────────────────────────────────────────────────────
function showQuestion() {
  const q = state.questions[state.currentIndex];
  state.answerRevealed = false;

  showScreen('question');

  // Header
  $('question-progress').textContent = `שאלה ${state.currentIndex + 1} מתוך ${state.questions.length}`;
  $('question-topic').textContent = TOPIC_LABELS[q.topic] || q.topic;

  // Question text
  $('question-text').textContent = q.question;

  // Options
  const optContainer = $('options-container');
  optContainer.innerHTML = '';
  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      optContainer.appendChild(btn);
    });
  }

  // Answer reveal
  $('correct-answer-text').textContent = q.answer;
  $('answer-reveal').classList.add('hidden');

  // Reveal button
  const revealBtn = $('reveal-btn');
  revealBtn.classList.remove('hidden');

  // Award buttons
  const awardContainer = $('award-buttons');
  awardContainer.innerHTML = '';
  state.selectedPlayers.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'award-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => awardPoint(name));
    awardContainer.appendChild(btn);
  });

  startTimer();
}

function startTimer() {
  state.timeLeft = 10;
  updateTimerUI(10);

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerUI(state.timeLeft);
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      revealAnswer();
    }
  }, 1000);
}

function updateTimerUI(t) {
  const bar = $('timer-bar');
  const display = $('timer-display');
  const pct = (t / 10) * 100;

  bar.style.width = pct + '%';
  display.textContent = t;

  const cls = t <= 3 ? 'danger' : t <= 6 ? 'warning' : '';
  bar.className = 'timer-bar' + (cls ? ' ' + cls : '');
  display.className = 'timer-display' + (cls ? ' ' + cls : '');
}

function revealAnswer() {
  if (state.answerRevealed) return;
  state.answerRevealed = true;
  clearInterval(state.timerInterval);

  const q = state.questions[state.currentIndex];

  // Highlight correct option
  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    document.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.textContent === q.answer) {
        btn.classList.add('correct');
      }
    });
  }

  $('answer-reveal').classList.remove('hidden');
  $('reveal-btn').classList.add('hidden');
}

// Reveal button
$('reveal-btn').addEventListener('click', revealAnswer);

function awardPoint(playerName) {
  clearInterval(state.timerInterval);
  if (!state.answerRevealed) revealAnswer();

  if (playerName) {
    state.scores[playerName] = (state.scores[playerName] || 0) + 1;
  }

  nextQuestion();
}

$('nobody-btn').addEventListener('click', () => awardPoint(null));

function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    showEndScreen();
  } else {
    showQuestion();
  }
}

// ── End Screen ────────────────────────────────────────────────────────────────
function showEndScreen() {
  showScreen('end');

  const sorted = state.selectedPlayers
    .map(name => ({ name, score: state.scores[name] || 0 }))
    .sort((a, b) => b.score - a.score);

  const container = $('final-scores');
  container.innerHTML = '';

  const medals = ['🥇', '🥈', '🥉'];
  sorted.forEach((player, i) => {
    const row = document.createElement('div');
    row.className = 'score-row' + (i === 0 ? ' winner' : '');
    row.innerHTML = `
      <div>
        <span class="rank">${medals[i] || (i + 1) + '.'}</span>
        <span>${player.name}</span>
      </div>
      <span class="score-points">${player.score}</span>
    `;
    container.appendChild(row);
  });
}

// New game
$('new-game-btn').addEventListener('click', () => {
  showScreen('setup');
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderPlayers();
