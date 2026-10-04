// The one Supabase client. Missing (null) when there's no config — e.g. in `npm test`, where the store runs on
// the in-memory sample studio instead.
import { createClient } from '@supabase/supabase-js'

const env = import.meta.env ?? {}
export const supabase = env.VITE_SUPABASE_URL ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY) : null
