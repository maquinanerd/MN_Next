import 'server-only';
import { cookies, draftMode } from 'next/headers';
import { PREVIEW_COOKIE, grantAllows } from '@mn/content/security/preview';
import { serverEnv } from '@mn/content/env';

/**
 * Preview authorisation, checked by every preview surface.
 *
 * `draftMode()` is a single global flag: it says "this browser is previewing", not
 * "this browser may preview *this* article". On its own it would let one legitimately
 * issued token read every unpublished slug someone can guess. The signed grant cookie
 * names the one slug the token opened, and this is the function that enforces it.
 *
 * Returns false — never throws — so a page can simply fall through to `notFound()`.
 */
export async function previewAllows(slug: string): Promise<boolean> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return false;

  let secret: string | undefined;
  try {
    secret = serverEnv().KAL_EL_PREVIEW_SECRET;
  } catch {
    return false;
  }
  if (!secret) return false;

  const grant = (await cookies()).get(PREVIEW_COOKIE)?.value;
  return grantAllows(secret, grant, slug);
}

/** True when a preview session is open at all, for rendering the exit banner. */
export async function previewSessionOpen(): Promise<boolean> {
  const { isEnabled } = await draftMode();
  return isEnabled;
}
