-- Wordle Together Database Schema
-- Run this in the Supabase SQL Editor to set up the database

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    current_word TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game states table (tracks each player's progress in a room)
CREATE TABLE IF NOT EXISTS game_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    guesses JSONB DEFAULT '[]',
    guess_count INTEGER DEFAULT 0,
    green_count INTEGER DEFAULT 0,
    yellow_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'playing', -- 'playing', 'won', 'lost'
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(room_id, user_id)
);

-- Match results table (for scoreboard/history)
CREATE TABLE IF NOT EXISTS match_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id),
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id), -- NULL for draws
    player1_guesses INTEGER,
    player2_guesses INTEGER,
    word TEXT NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stats table
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    guess_distribution JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_states_room ON game_states(room_id);
CREATE INDEX IF NOT EXISTS idx_game_states_user ON game_states(user_id);
CREATE INDEX IF NOT EXISTS idx_match_results_players ON match_results(player1_id, player2_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for anon key - suitable for this game)
-- In production, you'd want more restrictive policies

CREATE POLICY "Allow all operations on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on rooms" ON rooms
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on game_states" ON game_states
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on match_results" ON match_results
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on user_stats" ON user_stats
    FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for the tables we need to sync
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;
