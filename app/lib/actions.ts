'use server';

import { revalidatePath } from 'next/cache';

import { setActiveCycle } from './dataset';

/** Bascule l'application sur un autre cycle déjà importé. */
export async function selectCycle(form: FormData): Promise<void> {
  const id = String(form.get('cycle') ?? '');
  if (id) {
    setActiveCycle(id);
    revalidatePath('/', 'layout');
  }
}
