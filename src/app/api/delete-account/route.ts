import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return new Response('Falta el token de autorizacion.', { status: 401 })
  }

  const token = authHeader.replace('Bearer', '').trim()
  if (!token) {
    return new Response('Token invalido.', { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Supabase no esta configurado.', { status: 500 })
  }

  if (!serviceRoleKey) {
    return new Response('Falta SUPABASE_SERVICE_ROLE_KEY.', { status: 501 })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await userClient.auth.getUser(token)

  if (error || !data.user) {
    return new Response('Sesion no valida.', { status: 401 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    data.user.id,
  )

  if (deleteError) {
    return new Response(deleteError.message, { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
