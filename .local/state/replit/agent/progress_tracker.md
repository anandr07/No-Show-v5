[x] 1. Install the required packages (cross-env, bcryptjs, jsonwebtoken, cookie-parser, types)
[x] 2. Restart the workflow to see if the project is working — backend running on port 5000
[x] 3. Migrate Supabase to Neon Postgres
  [x] 1. Move Supabase client calls to the server — replaced with JWT auth via /api/auth/* routes
  [x] 2. Port Supabase Edge Functions into server routes — registered in server/auth.ts
  [x] 3. Secure API keys & env vars — JWT_SECRET set as env var; no Supabase keys needed
  [x] 4. Push the database schema using `npm run db:push` — schema applied successfully
  [x] 5. Remove Supabase code — lib/supabase.ts stubbed; context/AuthContext.tsx rewritten
[x] 4. Verify the project is working — /api/health, /api/auth/signup, /api/auth/signin all tested OK
[x] 5. Inform user the import is completed and they can start building
