// Wordle Together - Main Application

import './styles/index.css';
import { Game } from './game.js';
import { Keyboard } from './keyboard.js';
import { Multiplayer } from './multiplayer.js';
import {
  initUI,
  initModal,
  showToast,
  showUsernameModal,
  showRoomModal,
  showWaitingModal,
  showResultsModal,
  showStatsModal,
  showSettingsModal,
  hideModal
} from './ui.js';
import {
  getUsername,
  setUsername,
  getUserId,
  setUserId,
  getTheme,
  setTheme,
  getHardMode,
  setHardMode,
  getLocalStats,
  updateLocalStats
} from './storage.js';
import { getUserStats, updateUserStats } from './supabase.js';

// Supabase configuration
// Replace these with your Supabase project credentials
const SUPABASE_URL = 'https://oznzohhtwsbamneuoeug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bnpvaGh0d3NiYW1uZXVvZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MDgwMDksImV4cCI6MjA4MjQ4NDAwOX0.39VlSO5FDsnMZPtbQgysZtbGhqaDskxEBOh8ufLMSyo';

// App state
let game = null;
let keyboard = null;
let multiplayer = null;
let isMultiplayer = false;
let waitingForOpponent = false;

// DOM elements
const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const opponentPanel = document.getElementById('opponent-panel');
const opponentNameEl = document.getElementById('opponent-name');
const opponentGuessesEl = document.querySelector('#opponent-guesses .stat-value');
const opponentGreenEl = document.querySelector('#opponent-green .stat-value');
const opponentYellowEl = document.querySelector('#opponent-yellow .stat-value');
const opponentStatusEl = document.getElementById('opponent-status');
const statsBtn = document.getElementById('stats-btn');
const settingsBtn = document.getElementById('settings-btn');
const themeBtn = document.getElementById('theme-btn');

// Initialize app
async function init() {
  initUI();
  initModal();

  // Apply saved theme
  applyTheme(getTheme());

  // Initialize keyboard
  keyboard = new Keyboard(keyboardEl, (key) => {
    if (game) {
      game.handleKeyPress(key);
    }
  });

  // Initialize multiplayer
  multiplayer = new Multiplayer(
    onOpponentJoin,
    onOpponentUpdate,
    onGameReset,
    onRoomUpdate
  );

  // Check if Supabase is configured
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    showOfflineMode();
    return;
  }

  // Initialize Supabase
  try {
    await multiplayer.init(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showOfflineMode();
    return;
  }

  // Check for existing username
  const savedUsername = getUsername();
  if (savedUsername) {
    try {
      await multiplayer.login(savedUsername);
      showRoomSelection();
    } catch (error) {
      showUsernamePrompt();
    }
  } else {
    showUsernamePrompt();
  }

  // Set up event listeners
  setupEventListeners();
}

function showOfflineMode() {
  // Show message and start single-player mode
  showToast('Supabase not configured - running in single-player mode', 'default', 4000);

  // Initialize game in single-player mode
  import('./words.js').then(({ getRandomWord }) => {
    game = new Game(
      boardEl,
      keyboard,
      null,
      (won, guesses) => {
        updateLocalStats(won, guesses);
        if (won) {
          showToast(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][guesses - 1], 'success', 3000);
        } else {
          import('./words.js').then(({ SOLUTIONS }) => {
            // Get the word from game state
            showToast(`The word was ${game.targetWord.toUpperCase()}`, 'default', 4000);
          });
        }
      }
    );
    game.startGame(getRandomWord());
  });

  setupEventListeners();
}

function showUsernamePrompt() {
  showUsernameModal(async (username) => {
    try {
      await multiplayer.login(username);
      setUsername(username);
      setUserId(multiplayer.user.id);
      showRoomSelection();
    } catch (error) {
      showToast('Failed to create user. Please try again.', 'error');
      showUsernamePrompt();
    }
  });
}

function showRoomSelection() {
  showRoomModal(
    // Create room
    async () => {
      try {
        const room = await multiplayer.createNewRoom();
        isMultiplayer = true;
        waitingForOpponent = true;

        showWaitingModal(room.code, () => {
          // Copy code callback
        });

        // Start game in waiting state
        game = new Game(
          boardEl,
          keyboard,
          onGuessComplete,
          onGameEnd
        );
        game.startGame(room.current_word);

      } catch (error) {
        console.error('Failed to create room:', error);
        showToast('Failed to create room. Please try again.', 'error');
        showRoomSelection();
      }
    },
    // Join room
    async (code) => {
      try {
        const room = await multiplayer.joinExistingRoom(code);
        isMultiplayer = true;
        waitingForOpponent = false;

        hideModal();

        // Show opponent panel
        updateOpponentPanel({
          username: multiplayer.getOpponentName()
        }, {
          guess_count: 0,
          green_count: 0,
          yellow_count: 0,
          status: 'playing'
        });
        opponentPanel.style.display = 'flex';

        // Start game
        game = new Game(
          boardEl,
          keyboard,
          onGuessComplete,
          onGameEnd
        );
        game.startGame(room.current_word);

        showToast('Joined room! Game starting...', 'success');

      } catch (error) {
        console.error('Failed to join room:', error);
        showToast('Room not found or already full', 'error');
        showRoomSelection();
      }
    }
  );
}

function setupEventListeners() {
  // Stats button
  statsBtn.addEventListener('click', async () => {
    let stats;
    if (multiplayer?.user) {
      try {
        stats = await getUserStats(multiplayer.user.id);
      } catch {
        stats = getLocalStats();
      }
    } else {
      stats = getLocalStats();
    }
    showStatsModal(stats);
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    showSettingsModal(
      {
        hardMode: getHardMode(),
        theme: getTheme()
      },
      () => {
        const newValue = !getHardMode();
        setHardMode(newValue);
        showToast(newValue ? 'Hard mode enabled' : 'Hard mode disabled');
      },
      () => {
        const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        applyTheme(newTheme);
      }
    );
  });

  // Theme button
  themeBtn.addEventListener('click', () => {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme(newTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Multiplayer callbacks
function onOpponentJoin(opponent) {
  waitingForOpponent = false;
  hideModal();

  // Show opponent panel
  updateOpponentPanel(opponent, {
    guess_count: 0,
    green_count: 0,
    yellow_count: 0,
    status: 'playing'
  });
  opponentPanel.style.display = 'flex';

  showToast(`${opponent.username} joined the game!`, 'success');
}

function onOpponentUpdate(state) {
  updateOpponentPanel(multiplayer.opponent, state);
}

function onGameReset(newWord) {
  // Reset game with new word
  game.startGame(newWord);

  // Reset opponent panel
  updateOpponentPanel(multiplayer.opponent, {
    guess_count: 0,
    green_count: 0,
    yellow_count: 0,
    status: 'playing'
  });

  showToast('New puzzle started!', 'success');
}

function onRoomUpdate(room) {
  // Handle room status changes
  if (room.status === 'finished') {
    showToast('Opponent left the room', 'default');
    isMultiplayer = false;
    opponentPanel.style.display = 'none';
  }
}

function updateOpponentPanel(opponent, state) {
  if (!opponent) return;

  opponentNameEl.textContent = opponent.username;
  opponentGuessesEl.textContent = state.guess_count;
  opponentGreenEl.textContent = state.green_count;
  opponentYellowEl.textContent = state.yellow_count;

  if (state.status === 'won') {
    opponentStatusEl.textContent = 'Finished!';
    opponentStatusEl.className = 'opponent-status won';
  } else if (state.status === 'lost') {
    opponentStatusEl.textContent = 'Failed';
    opponentStatusEl.className = 'opponent-status lost';
  } else {
    opponentStatusEl.textContent = 'Playing...';
    opponentStatusEl.className = 'opponent-status';
  }
}

// Game callbacks
async function onGuessComplete(guessCount, greenCount, yellowCount, won = null) {
  if (!isMultiplayer) return;

  const status = won === true ? 'won' : (won === false ? 'lost' : 'playing');
  await multiplayer.updateMyGameState(guessCount, greenCount, yellowCount, status);
}

async function onGameEnd(won, guesses) {
  // Update stats
  if (multiplayer?.user) {
    try {
      await updateUserStats(multiplayer.user.id, won, guesses);
    } catch {
      updateLocalStats(won, guesses);
    }
  } else {
    updateLocalStats(won, guesses);
  }

  if (!isMultiplayer) {
    // Single player mode
    if (won) {
      const messages = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
      showToast(messages[guesses - 1], 'success', 3000);
    } else {
      showToast(`The word was ${game.targetWord.toUpperCase()}`, 'default', 4000);
    }
    return;
  }

  // Multiplayer mode - check if opponent finished
  const checkOpponent = async () => {
    const opponentFinished = await multiplayer.checkBothFinished();

    if (opponentFinished) {
      // Both finished - show results
      try {
        const results = await multiplayer.getResults(won, guesses);
        showResultsModal(
          results,
          () => multiplayer.triggerNextPuzzle(),
          async () => {
            await multiplayer.leaveRoom();
            isMultiplayer = false;
            opponentPanel.style.display = 'none';
            showRoomSelection();
          }
        );
      } catch (error) {
        console.error('Failed to get results:', error);
        showToast('Failed to load results', 'error');
      }
    } else {
      // Wait for opponent
      showToast(won ? 'Waiting for opponent to finish...' : 'Waiting for opponent...', 'default', 2000);

      // Poll for opponent completion
      const pollInterval = setInterval(async () => {
        const finished = await multiplayer.checkBothFinished();
        if (finished) {
          clearInterval(pollInterval);
          const results = await multiplayer.getResults(won, guesses);
          showResultsModal(
            results,
            () => multiplayer.triggerNextPuzzle(),
            async () => {
              await multiplayer.leaveRoom();
              isMultiplayer = false;
              opponentPanel.style.display = 'none';
              showRoomSelection();
            }
          );
        }
      }, 1000);

      // Also listen for real-time updates
      const originalHandler = multiplayer.onOpponentUpdate;
      multiplayer.onOpponentUpdate = async (state) => {
        originalHandler?.(state);
        if (state.status !== 'playing') {
          clearInterval(pollInterval);
          multiplayer.onOpponentUpdate = originalHandler;
          const results = await multiplayer.getResults(won, guesses);
          showResultsModal(
            results,
            () => multiplayer.triggerNextPuzzle(),
            async () => {
              await multiplayer.leaveRoom();
              isMultiplayer = false;
              opponentPanel.style.display = 'none';
              showRoomSelection();
            }
          );
        }
      };
    }
  };

  // Small delay to ensure our state is saved first
  setTimeout(checkOpponent, 500);
}

// Start the app
init();
