import { supabase } from './supabase'

export async function logActivity({ projectId, actorId, actorName, action, entityType, entityId, summary, metadata = {} }) {
  const { error } = await supabase.from('activity_log').insert({
    project_id: projectId,
    actor_id: actorId,
    actor_name: actorName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata,
  })
  if (error) console.error('Failed to log activity:', error)
}
