// Multiplayer manager - handles room state and real-time sync

import {
    initSupabase,
    createOrGetUser,
    createRoom,
    joinRoom,
    getRoom,
    updateGameState,
    getOpponentState,
    saveMatchResult,
    getHeadToHead,
    startNextPuzzle,
    subscribeToRoom,
    subscribeToGameStates,
    unsubscribe,
    leaveRoom as leaveRoomDb,
    getUserById
} from './supabase.js';
import { getRandomWord } from './words.js';
import { showToast } from './ui.js';

export class Multiplayer {
    constructor(onOpponentJoin, onOpponentUpdate, onGameReset, onRoomUpdate) {
        this.user = null;
        this.room = null;
        this.opponent = null;
        this.roomChannel = null;
        this.gameChannel = null;

        // Callbacks
        this.onOpponentJoin = onOpponentJoin;
        this.onOpponentUpdate = onOpponentUpdate;
        this.onGameReset = onGameReset;
        this.onRoomUpdate = onRoomUpdate;

        // Scoreboard
        this.myScore = 0;
        this.opponentScore = 0;
        this.draws = 0;
    }

    async init(supabaseUrl, supabaseKey) {
        initSupabase(supabaseUrl, supabaseKey);
    }

    async login(username) {
        try {
            this.user = await createOrGetUser(username);
            return this.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async createNewRoom() {
        if (!this.user) throw new Error('Not logged in');

        try {
            const word = getRandomWord();
            this.room = await createRoom(this.user.id, word);

            // Subscribe to room updates (for when opponent joins)
            this.subscribeToUpdates();

            return this.room;
        } catch (error) {
            console.error('Create room error:', error);
            throw error;
        }
    }

    async joinExistingRoom(code) {
        if (!this.user) throw new Error('Not logged in');

        try {
            this.room = await joinRoom(code, this.user.id);

            // Get opponent info
            const opponentId = this.room.player1_id === this.user.id
                ? this.room.player2_id
                : this.room.player1_id;
            this.opponent = await getUserById(opponentId);

            // Load head-to-head history
            await this.loadHeadToHead();

            // Subscribe to updates
            this.subscribeToUpdates();

            return this.room;
        } catch (error) {
            console.error('Join room error:', error);
            throw error;
        }
    }

    subscribeToUpdates() {
        if (!this.room) return;

        // Subscribe to room changes (opponent joining, game reset)
        this.roomChannel = subscribeToRoom(this.room.id, async (updatedRoom) => {
            const oldRoom = this.room;
            this.room = updatedRoom;

            // Check if opponent just joined
            if (!oldRoom.player2_id && updatedRoom.player2_id) {
                const opponentId = updatedRoom.player1_id === this.user.id
                    ? updatedRoom.player2_id
                    : updatedRoom.player1_id;
                this.opponent = await getUserById(opponentId);

                // Load head-to-head history
                await this.loadHeadToHead();

                if (this.onOpponentJoin) {
                    this.onOpponentJoin(this.opponent);
                }
            }

            // Check if game was reset (new word)
            if (updatedRoom.status === 'playing' && oldRoom.current_word !== updatedRoom.current_word) {
                if (this.onGameReset) {
                    this.onGameReset(updatedRoom.current_word);
                }
            }

            if (this.onRoomUpdate) {
                this.onRoomUpdate(updatedRoom);
            }
        });

        // Subscribe to game state changes (opponent progress)
        this.gameChannel = subscribeToGameStates(this.room.id, this.user.id, (opponentState) => {
            if (this.onOpponentUpdate) {
                this.onOpponentUpdate(opponentState);
            }
        });
    }

    async loadHeadToHead() {
        if (!this.user || !this.opponent) return;

        try {
            // Always pass user IDs in consistent order (my ID first)
            const stats = await getHeadToHead(this.user.id, this.opponent.id);
            // user1Wins corresponds to first argument (my ID)
            this.myScore = stats.user1Wins;
            this.opponentScore = stats.user2Wins;
            this.draws = stats.draws;
            console.log('Loaded head-to-head:', { myScore: this.myScore, opponentScore: this.opponentScore, draws: this.draws });
        } catch (error) {
            console.error('Failed to load head-to-head:', error);
        }
    }

    async updateMyGameState(guessCount, greenCount, yellowCount, status = 'playing') {
        if (!this.room || !this.user) return;

        try {
            await updateGameState(this.room.id, this.user.id, {
                guess_count: guessCount,
                green_count: greenCount,
                yellow_count: yellowCount,
                status,
                completed_at: status !== 'playing' ? new Date().toISOString() : null
            });
        } catch (error) {
            console.error('Failed to update game state:', error);
        }
    }

    async checkBothFinished() {
        if (!this.room) return null;

        try {
            const opponentState = await getOpponentState(this.room.id, this.user.id);
            return opponentState && opponentState.status !== 'playing';
        } catch (error) {
            console.error('Failed to check opponent state:', error);
            return false;
        }
    }

    async getResults(myWon, myGuesses) {
        if (!this.room || !this.opponent) return null;

        try {
            const opponentState = await getOpponentState(this.room.id, this.user.id);
            const opponentWon = opponentState.status === 'won';
            const opponentGuesses = opponentState.guess_count;

            // Determine winner
            let won = false;
            let draw = false;
            let winnerId = null;

            if (myWon && opponentWon) {
                // Both won - fewer guesses wins
                if (myGuesses < opponentGuesses) {
                    won = true;
                    winnerId = this.user.id;
                } else if (opponentGuesses < myGuesses) {
                    won = false;
                    winnerId = this.opponent.id;
                } else {
                    draw = true;
                }
            } else if (myWon && !opponentWon) {
                won = true;
                winnerId = this.user.id;
            } else if (!myWon && opponentWon) {
                won = false;
                winnerId = this.opponent.id;
            } else {
                // Both lost
                draw = true;
            }

            // Only the host (player1) saves the match result to prevent duplicates
            if (this.isHost()) {
                await saveMatchResult(
                    this.room.id,
                    this.room.player1_id,
                    this.room.player2_id,
                    winnerId,
                    myGuesses || 7, // 7 if didn't win (more than max 6)
                    opponentGuesses || 7,
                    this.room.current_word
                );
            }

            // Reload scores from database to ensure accuracy
            await this.loadHeadToHead();

            return {
                won,
                draw,
                myGuesses: myWon ? myGuesses : null,
                opponentGuesses: opponentWon ? opponentGuesses : null,
                myName: this.user.username,
                opponentName: this.opponent.username,
                word: this.room.current_word,
                myScore: this.myScore,
                opponentScore: this.opponentScore,
                draws: this.draws
            };
        } catch (error) {
            console.error('Failed to get results:', error);
            throw error;
        }
    }

    async triggerNextPuzzle() {
        if (!this.room) return;

        try {
            const newWord = getRandomWord();
            await startNextPuzzle(this.room.id, newWord);
            showToast('Starting new puzzle!', 'success');
        } catch (error) {
            console.error('Failed to start next puzzle:', error);
            showToast('Failed to start next puzzle', 'error');
        }
    }

    async leaveRoom() {
        if (!this.room) return;

        try {
            // Unsubscribe from channels
            if (this.roomChannel) {
                unsubscribe(this.roomChannel);
                this.roomChannel = null;
            }
            if (this.gameChannel) {
                unsubscribe(this.gameChannel);
                this.gameChannel = null;
            }

            await leaveRoomDb(this.room.id);

            this.room = null;
            this.opponent = null;
            this.myScore = 0;
            this.opponentScore = 0;
            this.draws = 0;
        } catch (error) {
            console.error('Failed to leave room:', error);
        }
    }

    getCurrentWord() {
        return this.room?.current_word || null;
    }

    isHost() {
        return this.room && this.user && this.room.player1_id === this.user.id;
    }

    getOpponentName() {
        return this.opponent?.username || 'Opponent';
    }

    getRoomCode() {
        return this.room?.code || '';
    }
}
