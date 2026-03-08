import { buildMasteryMap } from '@/src/domain/progress';
import { getAuthenticatedUserId, listUserItemProgress } from '@/src/features/user-data/repository';
import { createClient } from '@/src/lib/supabase/server';

export async function loadUserMasteryMap(): Promise<Map<string, number>> {
  try {
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId(supabase);
    const progressRows = await listUserItemProgress(supabase, userId);
    return buildMasteryMap(progressRows);
  } catch {
    return new Map();
  }
}
