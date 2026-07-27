// ⚠️ TEMPORARY STUB — specs/02-email-notifications.md hasn't been implemented
// yet (it's next on the build order per GETTING_STARTED.md), but spec 01's
// endpoints already need trigger points to call. This signature matches what
// spec 02 defines (sendEmail({ to, template, data })) exactly, so replacing
// this stub with the real EmailLog-backed implementation should require zero
// changes at any call site — only this file.
export async function sendEmail({
  to,
  template,
  data,
}: {
  to: string;
  template: string;
  data: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[email:stub] would send "${template}" to ${to}`, data);
  }
  return { success: true };
}
