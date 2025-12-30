// UI utilities - toasts, modals, etc.

// Toast notifications
let toastContainer = null;

export function initUI() {
    toastContainer = document.getElementById('toast-container');
}

export function showToast(message, type = 'default', duration = 2000) {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);

    return toast;
}

// Modal management
let modalOverlay = null;
let modalContent = null;
let modalCloseBtn = null;
let onModalClose = null;

export function initModal() {
    modalOverlay = document.getElementById('modal-overlay');
    modalContent = document.getElementById('modal-content');
    modalCloseBtn = document.getElementById('modal-close');

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    // Close on button click
    modalCloseBtn.addEventListener('click', () => {
        hideModal();
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            hideModal();
        }
    });
}

export function showModal(content, options = {}) {
    if (!modalOverlay) initModal();

    // Set content
    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.innerHTML = '';
        modalContent.appendChild(content);
    }

    // Options
    if (options.hideClose) {
        modalCloseBtn.style.display = 'none';
    } else {
        modalCloseBtn.style.display = '';
    }

    if (options.onClose) {
        onModalClose = options.onClose;
    }

    // Show
    modalOverlay.classList.add('active');

    // Focus first input if exists
    setTimeout(() => {
        const input = modalContent.querySelector('input');
        if (input) input.focus();
    }, 100);
}

export function hideModal() {
    if (!modalOverlay) return;

    modalOverlay.classList.remove('active');

    if (onModalClose) {
        onModalClose();
        onModalClose = null;
    }
}

// Username modal
export function showUsernameModal(onSubmit) {
    const content = `
    <div class="modal-header">
      <h2>Welcome to Wordle Together!</h2>
      <p>Enter a username to get started</p>
    </div>
    <form class="modal-form" id="username-form">
      <div class="form-group">
        <label class="form-label" for="username-input">Username</label>
        <input 
          type="text" 
          id="username-input" 
          class="form-input" 
          placeholder="Enter your username"
          maxlength="20"
          required
          autocomplete="off"
        />
        <p class="form-hint">3-20 characters, letters and numbers only</p>
      </div>
      <button type="submit" class="btn-primary">Continue</button>
    </form>
  `;

    showModal(content, { hideClose: true });

    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = input.value.trim();

        // Validate
        if (username.length < 3) {
            showToast('Username must be at least 3 characters', 'error');
            input.classList.add('error');
            return;
        }

        if (!/^[a-zA-Z0-9]+$/.test(username)) {
            showToast('Username can only contain letters and numbers', 'error');
            input.classList.add('error');
            return;
        }

        hideModal();
        onSubmit(username);
    });

    input.addEventListener('input', () => {
        input.classList.remove('error');
    });
}

// Room modal
export function showRoomModal(onCreateRoom, onJoinRoom) {
    const content = `
    <div class="modal-header">
      <h2>Play with a Friend</h2>
      <p>Create a new room or join an existing one</p>
    </div>
    <div class="modal-actions">
      <button class="btn-primary" id="create-room-btn">Create Room</button>
      <button class="btn-secondary" id="join-room-btn">Join Room</button>
    </div>
  `;

    showModal(content);

    document.getElementById('create-room-btn').addEventListener('click', () => {
        hideModal();
        onCreateRoom();
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
        hideModal();
        showJoinRoomModal(onJoinRoom);
    });
}

export function showJoinRoomModal(onJoinRoom) {
    const content = `
    <div class="modal-header">
      <h2>Join Room</h2>
      <p>Enter the room code from your friend</p>
    </div>
    <form class="modal-form" id="join-form">
      <div class="form-group">
        <label class="form-label" for="room-code-input">Room Code</label>
        <input 
          type="text" 
          id="room-code-input" 
          class="form-input" 
          placeholder="ABC123"
          maxlength="6"
          required
          autocomplete="off"
          style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-weight: 700;"
        />
      </div>
      <button type="submit" class="btn-primary">Join Room</button>
    </form>
  `;

    showModal(content);

    const form = document.getElementById('join-form');
    const input = document.getElementById('room-code-input');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = input.value.trim().toUpperCase();

        if (code.length !== 6) {
            showToast('Room code must be 6 characters', 'error');
            input.classList.add('error');
            return;
        }

        hideModal();
        onJoinRoom(code);
    });
}

export function showWaitingModal(roomCode, onCopyCode) {
    const content = `
    <div class="modal-header">
      <h2>Room Created!</h2>
      <p>Share this code with your friend</p>
    </div>
    <div class="room-code-display">
      <span class="room-code">${roomCode}</span>
      <button class="room-code-copy" id="copy-code-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy Code
      </button>
    </div>
    <div class="waiting-animation">
      <div class="waiting-dots">
        <div class="waiting-dot"></div>
        <div class="waiting-dot"></div>
        <div class="waiting-dot"></div>
      </div>
      <p class="waiting-text">Waiting for opponent to join...</p>
    </div>
  `;

    showModal(content, { hideClose: false });

    document.getElementById('copy-code-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(roomCode).then(() => {
            showToast('Code copied!', 'success');
        });
        if (onCopyCode) onCopyCode();
    });
}

export function showResultsModal(result, onNextPuzzle, onLeave) {
    const { won, draw, myGuesses, opponentGuesses, myName, opponentName, word, myScore, opponentScore, draws } = result;

    let headerClass = draw ? 'draw' : (won ? 'win' : 'lose');
    let headerText = draw ? "It's a Draw!" : (won ? 'You Won!' : 'You Lost!');

    const content = `
    <div class="results-header ${headerClass}">
      <h2>${headerText}</h2>
      <p class="results-word">The word was <strong>${word}</strong></p>
    </div>
    <div class="results-comparison">
      <div class="results-player ${won && !draw ? 'winner' : ''}">
        <p class="results-player-name">${myName} (You)</p>
        <p class="results-player-guesses">${myGuesses || 'X'}</p>
        <p class="results-player-label">guesses</p>
      </div>
      <div class="results-player ${!won && !draw ? 'winner' : ''}">
        <p class="results-player-name">${opponentName}</p>
        <p class="results-player-guesses">${opponentGuesses || 'X'}</p>
        <p class="results-player-label">guesses</p>
      </div>
    </div>
    <div class="scoreboard">
      <div class="scoreboard-players">
        <div class="scoreboard-player ${myScore > opponentScore ? 'winner' : ''}">
          <p class="scoreboard-player-name">${myName}</p>
          <p class="scoreboard-player-score">${myScore}</p>
        </div>
        <span class="scoreboard-vs">-</span>
        <div class="scoreboard-player ${opponentScore > myScore ? 'winner' : ''}">
          <p class="scoreboard-player-name">${opponentName}</p>
          <p class="scoreboard-player-score">${opponentScore}</p>
        </div>
      </div>
      <p class="scoreboard-draws">Draws: ${draws}</p>
    </div>
    <div class="modal-actions">
      <button class="btn-primary" id="next-puzzle-btn">Next Puzzle</button>
      <button class="btn-secondary" id="leave-room-btn">Leave Room</button>
    </div>
  `;

    showModal(content);

    document.getElementById('next-puzzle-btn').addEventListener('click', () => {
        hideModal();
        onNextPuzzle();
    });

    document.getElementById('leave-room-btn').addEventListener('click', () => {
        hideModal();
        onLeave();
    });
}

export function showStatsModal(stats) {
    const { gamesPlayed, gamesWon, currentStreak, maxStreak, guessDistribution } = stats;
    const winPct = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    // Find max for bar scaling
    const maxGuesses = Math.max(...Object.values(guessDistribution), 1);

    const distributionBars = [1, 2, 3, 4, 5, 6].map(n => {
        const count = guessDistribution[n] || 0;
        const width = Math.max((count / maxGuesses) * 100, 7);
        const isEmpty = count === 0;
        return `
      <div class="distribution-row">
        <span class="distribution-label">${n}</span>
        <div class="distribution-bar ${isEmpty ? 'empty' : ''}" style="width: ${width}%">
          <span class="distribution-value">${count}</span>
        </div>
      </div>
    `;
    }).join('');

    const content = `
    <div class="modal-header">
      <h2>Statistics</h2>
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-number">${gamesPlayed}</span>
        <span class="stat-label">Played</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${winPct}</span>
        <span class="stat-label">Win %</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${currentStreak}</span>
        <span class="stat-label">Current Streak</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${maxStreak}</span>
        <span class="stat-label">Max Streak</span>
      </div>
    </div>
    <div class="guess-distribution">
      <h3>Guess Distribution</h3>
      ${distributionBars}
    </div>
  `;

    showModal(content);
}

export function showSettingsModal(settings, onToggleHardMode, onToggleTheme) {
    const { hardMode, theme } = settings;

    const content = `
    <div class="modal-header">
      <h2>Settings</h2>
    </div>
    <div class="settings-list">
      <div class="settings-item">
        <div class="settings-info">
          <h3>Hard Mode</h3>
          <p>Any revealed hints must be used in subsequent guesses</p>
        </div>
        <button class="toggle ${hardMode ? 'active' : ''}" id="hard-mode-toggle">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="settings-item">
        <div class="settings-info">
          <h3>Dark Theme</h3>
          <p>Toggle dark/light mode</p>
        </div>
        <button class="toggle ${theme === 'dark' ? 'active' : ''}" id="theme-toggle">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>
  `;

    showModal(content);

    document.getElementById('hard-mode-toggle').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
        onToggleHardMode();
    });

    document.getElementById('theme-toggle').addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('active');
        onToggleTheme();
    });
}
