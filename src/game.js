// Core Wordle game logic

import { isValidWord } from './words.js';
import { showToast } from './ui.js';
import { getHardMode } from './storage.js';

const NUM_ROWS = 6;
const NUM_COLS = 5;

export class Game {
    constructor(boardEl, keyboard, onGuessComplete, onGameEnd) {
        this.boardEl = boardEl;
        this.keyboard = keyboard;
        this.onGuessComplete = onGuessComplete;
        this.onGameEnd = onGameEnd;

        this.targetWord = '';
        this.currentRow = 0;
        this.currentCol = 0;
        this.guesses = [];
        this.gameOver = false;
        this.won = false;

        // For hard mode validation
        this.revealedHints = {
            correct: {}, // position -> letter
            present: new Set() // letters that must be used
        };

        this.tiles = [];
        this.createBoard();
    }

    createBoard() {
        this.boardEl.innerHTML = '';
        this.tiles = [];

        for (let row = 0; row < NUM_ROWS; row++) {
            const rowTiles = [];
            for (let col = 0; col < NUM_COLS; col++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = row;
                tile.dataset.col = col;
                this.boardEl.appendChild(tile);
                rowTiles.push(tile);
            }
            this.tiles.push(rowTiles);
        }
    }

    startGame(targetWord) {
        this.targetWord = targetWord.toLowerCase();
        this.currentRow = 0;
        this.currentCol = 0;
        this.guesses = [];
        this.gameOver = false;
        this.won = false;
        this.revealedHints = {
            correct: {},
            present: new Set()
        };

        // Reset board
        this.createBoard();

        // Reset keyboard
        this.keyboard.reset();
    }

    handleKeyPress(key) {
        if (this.gameOver) return;

        if (key === 'ENTER') {
            this.submitGuess();
        } else if (key === 'BACKSPACE') {
            this.deleteLetter();
        } else if (/^[A-Z]$/.test(key)) {
            this.addLetter(key.toLowerCase());
        }
    }

    addLetter(letter) {
        if (this.currentCol >= NUM_COLS) return;

        const tile = this.tiles[this.currentRow][this.currentCol];
        tile.textContent = letter.toUpperCase();
        tile.classList.add('filled');
        this.currentCol++;
    }

    deleteLetter() {
        if (this.currentCol <= 0) return;

        this.currentCol--;
        const tile = this.tiles[this.currentRow][this.currentCol];
        tile.textContent = '';
        tile.classList.remove('filled');
    }

    getCurrentGuess() {
        let guess = '';
        for (let col = 0; col < NUM_COLS; col++) {
            guess += this.tiles[this.currentRow][col].textContent.toLowerCase();
        }
        return guess;
    }

    submitGuess() {
        const guess = this.getCurrentGuess();

        // Check if full word
        if (guess.length < NUM_COLS) {
            this.shakeRow();
            showToast('Not enough letters');
            return;
        }

        // Check if valid word
        if (!isValidWord(guess)) {
            this.shakeRow();
            showToast('Not in word list');
            return;
        }

        // Check hard mode constraints
        if (getHardMode() && !this.validateHardMode(guess)) {
            return; // Toast already shown in validateHardMode
        }

        // Evaluate the guess
        const result = this.evaluateGuess(guess);

        // Store guess
        this.guesses.push({
            word: guess,
            result: result
        });

        // Reveal tiles with animation
        this.revealRow(result);

        // Update hard mode hints
        this.updateRevealedHints(guess, result);

        // Check for win/loss after animation
        setTimeout(() => {
            const won = guess === this.targetWord;
            const lost = !won && this.currentRow >= NUM_ROWS;

            if (won) {
                this.gameOver = true;
                this.won = true;
                this.bounceRow(this.currentRow - 1);

                setTimeout(() => {
                    if (this.onGameEnd) {
                        this.onGameEnd(true, this.guesses.length);
                    }
                }, 500);
            } else if (lost) {
                this.gameOver = true;
                this.won = false;

                if (this.onGameEnd) {
                    this.onGameEnd(false, this.guesses.length);
                }
            }

            // Notify about guess completion for multiplayer sync
            if (this.onGuessComplete && !this.gameOver) {
                const greenCount = result.filter(r => r === 'correct').length;
                const yellowCount = result.filter(r => r === 'present').length;
                this.onGuessComplete(this.guesses.length, greenCount, yellowCount);
            } else if (this.onGuessComplete && this.gameOver) {
                const greenCount = result.filter(r => r === 'correct').length;
                const yellowCount = result.filter(r => r === 'present').length;
                this.onGuessComplete(this.guesses.length, greenCount, yellowCount, this.won);
            }
        }, NUM_COLS * 250 + 300);
    }

    evaluateGuess(guess) {
        const result = Array(NUM_COLS).fill('absent');
        const targetLetters = this.targetWord.split('');
        const guessLetters = guess.split('');

        // First pass: mark correct letters
        for (let i = 0; i < NUM_COLS; i++) {
            if (guessLetters[i] === targetLetters[i]) {
                result[i] = 'correct';
                targetLetters[i] = null; // Mark as used
                guessLetters[i] = null;
            }
        }

        // Second pass: mark present letters
        for (let i = 0; i < NUM_COLS; i++) {
            if (guessLetters[i] === null) continue;

            const targetIndex = targetLetters.indexOf(guessLetters[i]);
            if (targetIndex !== -1) {
                result[i] = 'present';
                targetLetters[targetIndex] = null; // Mark as used
            }
        }

        return result;
    }

    validateHardMode(guess) {
        // Check that all correct letters are in same position
        for (const [pos, letter] of Object.entries(this.revealedHints.correct)) {
            if (guess[pos] !== letter) {
                this.shakeRow();
                showToast(`${pos + 1}${this.getOrdinalSuffix(parseInt(pos) + 1)} letter must be ${letter.toUpperCase()}`);
                return false;
            }
        }

        // Check that all present letters are used
        for (const letter of this.revealedHints.present) {
            if (!guess.includes(letter)) {
                this.shakeRow();
                showToast(`Guess must contain ${letter.toUpperCase()}`);
                return false;
            }
        }

        return true;
    }

    getOrdinalSuffix(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    updateRevealedHints(guess, result) {
        for (let i = 0; i < result.length; i++) {
            if (result[i] === 'correct') {
                this.revealedHints.correct[i] = guess[i];
                this.revealedHints.present.delete(guess[i]); // No longer need to track as present
            } else if (result[i] === 'present') {
                // Only add if not already marked as correct somewhere
                if (!Object.values(this.revealedHints.correct).includes(guess[i])) {
                    this.revealedHints.present.add(guess[i]);
                }
            }
        }
    }

    revealRow(result) {
        const row = this.currentRow;

        for (let col = 0; col < NUM_COLS; col++) {
            const tile = this.tiles[row][col];
            const state = result[col];
            const letter = tile.textContent.toLowerCase();

            // Delay each tile
            setTimeout(() => {
                tile.classList.add('revealed', state, `reveal-${col + 1}`);

                // Update keyboard
                this.keyboard.updateKeyState(letter, state);
            }, col * 250);
        }

        // Move to next row
        this.currentRow++;
        this.currentCol = 0;
    }

    shakeRow() {
        const row = this.currentRow;
        for (let col = 0; col < NUM_COLS; col++) {
            const tile = this.tiles[row][col];
            tile.classList.add('shake');
            setTimeout(() => {
                tile.classList.remove('shake');
            }, 500);
        }
    }

    bounceRow(row) {
        for (let col = 0; col < NUM_COLS; col++) {
            const tile = this.tiles[row][col];
            setTimeout(() => {
                tile.style.animation = 'bounce 0.5s ease';
            }, col * 100);
        }
    }

    getState() {
        return {
            guessCount: this.guesses.length,
            gameOver: this.gameOver,
            won: this.won,
            lastGuessResult: this.guesses.length > 0 ? this.guesses[this.guesses.length - 1].result : null
        };
    }
}
