'use server';

import {
  archiveGoalAction,
  completeGoalAction,
  pauseGoalAction,
  setActiveGoalAction,
} from '@/src/features/user-data/server-actions';

export async function setActiveGoalFormAction(formData: FormData) {
  const goalId = String(formData.get('goalId') ?? '');
  if (!goalId) return;
  await setActiveGoalAction(goalId);
}

export async function pauseGoalFormAction(formData: FormData) {
  const goalId = String(formData.get('goalId') ?? '');
  if (!goalId) return;
  await pauseGoalAction(goalId);
}

export async function completeGoalFormAction(formData: FormData) {
  const goalId = String(formData.get('goalId') ?? '');
  if (!goalId) return;
  await completeGoalAction(goalId);
}

export async function archiveGoalFormAction(formData: FormData) {
  const goalId = String(formData.get('goalId') ?? '');
  if (!goalId) return;
  await archiveGoalAction(goalId, 'archiviato dalla UX goal management');
}
