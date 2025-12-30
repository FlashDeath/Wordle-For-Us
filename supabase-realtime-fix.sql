-- Quick Fix for Supabase Realtime
-- Run this in the Supabase SQL Editor if realtime isn't working

-- First, check if tables are already in the publication (ignore errors)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_states;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Alternative: Enable replica identity for realtime to work properly
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE game_states REPLICA IDENTITY FULL;
