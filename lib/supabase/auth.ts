import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, sites(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return { supabase, user, profile }
}
