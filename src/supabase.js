import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ajcerexliwbbjpjgajwn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqY2VyZXhsaXdiYmpwamdhanduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTg3NjYsImV4cCI6MjA5MzA3NDc2Nn0.N_5XAdykSrUoHLnEHLe8KOXjajRod3KRMjys_Cb_IhY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)