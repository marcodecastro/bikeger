import { getOpenRegister, openRegister, withSummary } from '../../src/services/cashService.js';

export async function ensureOpenRegister() {
  const open = await getOpenRegister();
  if (open) return withSummary(open);
  try {
    return await openRegister({ openingAmount: 0, operator: 'teste' });
  } catch (error) {
    if (error.status === 409) {
      const again = await getOpenRegister();
      if (again) return withSummary(again);
    }
    throw error;
  }
}
