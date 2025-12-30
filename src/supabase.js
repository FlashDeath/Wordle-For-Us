// Supabase client and database operations

import { createClient } from '@supabase/supabase-js';

// These will be set from environment or config
let supabase = null;

export function initSupabase(url, anonKey) {
    supabase = createClient(url, anonKey, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    });
    return supabase;
}

export function getSupabase() {
    return supabase;
}

// User operations
export async function createOrGetUser(username) {
    if (!supabase) throw new Error('Supabase not initialized');

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (existingUser) {
        return existingUser;
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ username })
        .select()
        .single();

    if (createError) {
        // If duplicate, try fetching again
        if (createError.code === '23505') {
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
            return user;
        }
        throw createError;
    }

    return newUser;
}

// Room operations
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export async function createRoom(userId, word) {
    if (!supabase) throw new Error('Supabase not initialized');

    const code = generateRoomCode();

    const { data, error } = await supabase
        .from('rooms')
        .insert({
            code,
            player1_id: userId,
            current_word: word,
            status: 'waiting'
        })
        .select()
        .single();

    if (error) throw error;

    // Create game state for player 1
    await supabase
        .from('game_states')
        .insert({
            room_id: data.id,
            user_id: userId,
            guesses: [],
            guess_count: 0,
            green_count: 0,
            yellow_count: 0,
            status: 'playing'
        });

    return data;
}

export async function joinRoom(code, userId) {
    if (!supabase) throw new Error('Supabase not initialized');

    // Find room
    const { data: room, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'waiting')
        .single();

    if (findError || !room) {
        throw new Error('Room not found or already full');
    }

    // Update room with player 2
    const { data: updatedRoom, error: updateError } = await supabase
        .from('rooms')
        .update({
            player2_id: userId,
            status: 'playing'
        })
        .eq('id', room.id)
        .select()
        .single();

    if (updateError) throw updateError;

    // Create game state for player 2
    await supabase
        .from('game_states')
        .insert({
            room_id: room.id,
            user_id: userId,
            guesses: [],
            guess_count: 0,
            green_count: 0,
            yellow_count: 0,
            status: 'playing'
        });

    return updatedRoom;
}

export async function getRoom(roomId) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

    if (error) throw error;
    return data;
}

export async function getRoomByCode(code) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

    if (error) throw error;
    return data;
}

// Game state operations
export async function updateGameState(roomId, userId, updates) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('game_states')
        .update(updates)
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getGameStates(roomId) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId);

    if (error) throw error;
    return data;
}

export async function getOpponentState(roomId, myUserId) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', myUserId)
        .single();

    if (error) throw error;
    return data;
}

// Match results
export async function saveMatchResult(roomId, player1Id, player2Id, winnerId, p1Guesses, p2Guesses, word) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('match_results')
        .insert({
            room_id: roomId,
            player1_id: player1Id,
            player2_id: player2Id,
            winner_id: winnerId,
            player1_guesses: p1Guesses,
            player2_guesses: p2Guesses,
            word
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getHeadToHead(userId1, userId2) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .or(`and(player1_id.eq.${userId1},player2_id.eq.${userId2}),and(player1_id.eq.${userId2},player2_id.eq.${userId1})`);

    if (error) throw error;

    // Calculate stats
    let user1Wins = 0;
    let user2Wins = 0;
    let draws = 0;

    data.forEach(match => {
        if (match.winner_id === null) {
            draws++;
        } else if (match.winner_id === userId1) {
            user1Wins++;
        } else {
            user2Wins++;
        }
    });

    return { user1Wins, user2Wins, draws, totalGames: data.length };
}

// User stats
export async function getUserStats(userId) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return default stats if none exist
    if (!data) {
        return {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        };
    }

    return {
        gamesPlayed: data.games_played,
        gamesWon: data.games_won,
        currentStreak: data.current_streak,
        maxStreak: data.max_streak,
        guessDistribution: data.guess_distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    };
}

export async function updateUserStats(userId, won, numGuesses) {
    if (!supabase) throw new Error('Supabase not initialized');

    // Get current stats
    const { data: current, error: fetchError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (!current) {
        // Create new stats record
        const newStats = {
            user_id: userId,
            games_played: 1,
            games_won: won ? 1 : 0,
            current_streak: won ? 1 : 0,
            max_streak: won ? 1 : 0,
            guess_distribution: won ? { [numGuesses]: 1 } : {}
        };

        const { error: insertError } = await supabase
            .from('user_stats')
            .insert(newStats);

        if (insertError) throw insertError;
        return;
    }

    // Update existing stats
    const distribution = current.guess_distribution || {};
    if (won) {
        distribution[numGuesses] = (distribution[numGuesses] || 0) + 1;
    }

    const newStreak = won ? current.current_streak + 1 : 0;

    const { error: updateError } = await supabase
        .from('user_stats')
        .update({
            games_played: current.games_played + 1,
            games_won: current.games_won + (won ? 1 : 0),
            current_streak: newStreak,
            max_streak: Math.max(current.max_streak, newStreak),
            guess_distribution: distribution
        })
        .eq('user_id', userId);

    if (updateError) throw updateError;
}

// Next puzzle
export async function startNextPuzzle(roomId, newWord) {
    if (!supabase) throw new Error('Supabase not initialized');

    // Update room with new word
    await supabase
        .from('rooms')
        .update({
            current_word: newWord,
            status: 'playing'
        })
        .eq('id', roomId);

    // Reset all game states for this room
    await supabase
        .from('game_states')
        .update({
            guesses: [],
            guess_count: 0,
            green_count: 0,
            yellow_count: 0,
            status: 'playing',
            completed_at: null
        })
        .eq('room_id', roomId);
}

// Real-time subscriptions
export function subscribeToRoom(roomId, onRoomUpdate) {
    if (!supabase) throw new Error('Supabase not initialized');

    return supabase
        .channel(`room:${roomId}`)
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`
            },
            payload => {
                onRoomUpdate(payload.new);
            }
        )
        .subscribe();
}

export function subscribeToGameStates(roomId, myUserId, onOpponentUpdate) {
    if (!supabase) throw new Error('Supabase not initialized');

    return supabase
        .channel(`game_states:${roomId}`)
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'game_states',
                filter: `room_id=eq.${roomId}`
            },
            payload => {
                // Only process opponent updates
                if (payload.new && payload.new.user_id !== myUserId) {
                    onOpponentUpdate(payload.new);
                }
            }
        )
        .subscribe();
}

export function unsubscribe(channel) {
    if (!supabase) return;
    supabase.removeChannel(channel);
}

// Leave room
export async function leaveRoom(roomId) {
    if (!supabase) throw new Error('Supabase not initialized');

    // Mark room as finished
    await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId);
}

// Get user by ID
export async function getUserById(userId) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}
