# Supabase Database Setup for No-Show

This guide walks you through setting up Supabase as the database for the No-Show card game.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose your organization, name the project (e.g. `noshow-game`)
4. Set a database password (save it securely)
5. Select a region close to your users
6. Click **Create new project**

## 2. Get Your Connection String

1. In the Supabase dashboard, go to **Project Settings** → **Database**
2. Under **Connection string**, select **URI**
3. Copy the connection string (it looks like `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`)
4. Replace `[YOUR-PASSWORD]` with your database password

## 3. Configure Environment Variables

Create or update your `.env` file in the project root:

```env
# Supabase Database (use Transaction pooler for serverless/ORM)
DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true

# Optional: For migrations, use the direct connection (Session mode)
# DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

**Note:** For `drizzle-kit push` and migrations, use the **direct** connection (not pooler). For the app at runtime, the pooler is recommended.

## 4. Run Migrations

```bash
# Push schema to Supabase (creates all tables)
npm run db:push
```

## 5. Enable Supabase Auth (Optional)

If you want user authentication:

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** (or other providers)
3. In **SQL Editor**, run this to auto-create profiles on signup:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', 'Player'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Note:** Add `ON CONFLICT (id) DO NOTHING` requires a unique constraint on profiles.id (primary key). If your profiles table uses `id` as PK, this works.

## 6. Database Schema Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends Supabase auth.users) |
| `rooms` | Multiplayer room lobbies |
| `room_players` | Players in a room lobby |
| `games` | Game sessions (VS, multiplayer, online) |
| `game_players` | Participants in a game |
| `game_history` | Stats/leaderboard records |
| `friends` | Friend list (placeholder) |
| `users` | Legacy auth (migrate to profiles) |

## 7. Row Level Security (RLS)

For production, enable RLS on Supabase tables. Example for `profiles`:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## 8. Verify Setup

```bash
# Check connection
npm run db:push
```

If successful, your tables will appear in Supabase **Table Editor**.
