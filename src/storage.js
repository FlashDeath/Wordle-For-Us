// Local storage utilities

const STORAGE_KEYS = {
    USERNAME: 'wordle_username',
    USER_ID: 'wordle_user_id',
    THEME: 'wordle_theme',
    HARD_MODE: 'wordle_hard_mode',
    STATS: 'wordle_stats'
};

// Get item from localStorage with JSON parsing
export function getItem(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
}

// Set item in localStorage with JSON stringifying
export function setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

// Remove item from localStorage
export function removeItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

// Username
export function getUsername() {
    return getItem(STORAGE_KEYS.USERNAME);
}

export function setUsername(username) {
    return setItem(STORAGE_KEYS.USERNAME, username);
}

// User ID
export function getUserId() {
    return getItem(STORAGE_KEYS.USER_ID);
}

export function setUserId(id) {
    return setItem(STORAGE_KEYS.USER_ID, id);
}

// Theme
export function getTheme() {
    return getItem(STORAGE_KEYS.THEME) || 'dark';
}

export function setTheme(theme) {
    return setItem(STORAGE_KEYS.THEME, theme);
}

// Hard mode
export function getHardMode() {
    return getItem(STORAGE_KEYS.HARD_MODE) || false;
}

export function setHardMode(enabled) {
    return setItem(STORAGE_KEYS.HARD_MODE, enabled);
}

// Stats (local fallback)
export function getLocalStats() {
    return getItem(STORAGE_KEYS.STATS) || {
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    };
}

export function setLocalStats(stats) {
    return setItem(STORAGE_KEYS.STATS, stats);
}

export function updateLocalStats(won, numGuesses) {
    const stats = getLocalStats();
    stats.gamesPlayed++;

    if (won) {
        stats.gamesWon++;
        stats.currentStreak++;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.guessDistribution[numGuesses] = (stats.guessDistribution[numGuesses] || 0) + 1;
    } else {
        stats.currentStreak = 0;
    }

    setLocalStats(stats);
    return stats;
}
