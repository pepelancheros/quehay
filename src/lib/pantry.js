import { supabase } from './supabase'

// Crea una despensa nueva y agrega al usuario como miembro
export async function createPantry(userId) {
  const { data, error } = await supabase.rpc('create_pantry_for_user', {
    p_user_id: userId,
  })
  if (error) throw error
  return data // retorna el pantry_id
}

// Une al usuario a una despensa existente usando el invite code
export async function joinPantry(inviteCode, userId) {
  const { data, error } = await supabase.rpc('join_pantry_by_code', {
    p_invite_code: inviteCode,
    p_user_id: userId,
  })
  if (error) throw error
  return data // retorna el pantry_id
}

// Obtiene la despensa del usuario actual (id + invite_code)
export async function getUserPantry() {
  const { data: member, error: memberError } = await supabase
    .from('pantry_members')
    .select('pantry_id')
    .single()
  if (memberError) throw memberError

  const { data: pantry, error: pantryError } = await supabase
    .from('pantries')
    .select('invite_code')
    .eq('id', member.pantry_id)
    .single()
  if (pantryError) throw pantryError

  return {
    id: member.pantry_id,
    inviteCode: pantry.invite_code,
  }
}

// Obtiene todos los ingredientes de una despensa
export async function getPantryItems(pantryId) {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('pantry_id', pantryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// Agrega un ingrediente
export async function addPantryItem(pantryId, name, quantity, unit) {
  const { data, error } = await supabase
    .from('pantry_items')
    .insert({ pantry_id: pantryId, name, quantity: quantity || null, unit: unit || null })
    .select()
    .single()
  if (error) throw error
  return data
}

// Elimina un ingrediente
export async function deletePantryItem(itemId) {
  const { error } = await supabase
    .from('pantry_items')
    .delete()
    .eq('id', itemId)
  if (error) throw error
}
