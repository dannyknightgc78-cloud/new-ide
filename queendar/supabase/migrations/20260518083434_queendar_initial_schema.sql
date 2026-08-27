/*
  # Queendar Initial Schema

  ## Overview
  Sets up the core database tables for the Queendar travel safety and nightlife companion app.

  ## New Tables

  ### profiles
  - `id` (uuid, PK, references auth.users) - User's unique identifier
  - `username` (text) - Display name
  - `bio` (text) - Short user bio
  - `avatar_url` (text) - Profile picture URL
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### crown_logs
  - `id` (uuid, PK) - Log entry unique identifier
  - `user_id` (uuid, FK -> profiles) - Owner of the log
  - `title` (text) - Log entry title
  - `body` (text) - Full log content
  - `mood` (text) - Optional mood tag
  - `location` (text) - Optional location tag
  - `created_at` (timestamptz) - Entry creation time
  - `updated_at` (timestamptz) - Last update time

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Crown logs table
CREATE TABLE IF NOT EXISTS crown_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  mood text DEFAULT '',
  location text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crown_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crown logs"
  ON crown_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own crown logs"
  ON crown_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own crown logs"
  ON crown_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own crown logs"
  ON crown_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
