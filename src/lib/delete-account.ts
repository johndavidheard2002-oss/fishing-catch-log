import { verifyPassword } from "./auth";
import { DELETE_ACCOUNT_PHRASE } from "./delete-account-phrase";
import { getAngler, getAnglerPasswordHash } from "./db/anglers";
import { deleteAnglerAccount } from "./db/delete-account";

export async function deleteJournalAccount(args: {
  anglerId: string;
  password: string;
  confirm: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (args.confirm.trim().toUpperCase() !== DELETE_ACCOUNT_PHRASE) {
    return { ok: false, error: "Type DELETE to confirm.", status: 400 };
  }
  const angler = await getAngler(args.anglerId, { includeEmail: true });
  if (!angler?.claimed) {
    return { ok: false, error: "Sign in required.", status: 401 };
  }
  const hash = await getAnglerPasswordHash(angler.id);
  if (!hash || !(await verifyPassword(args.password, hash))) {
    return { ok: false, error: "Password is wrong.", status: 401 };
  }
  const removed = await deleteAnglerAccount(angler.id);
  if (!removed) return { ok: false, error: "Could not delete this account.", status: 500 };
  return { ok: true };
}
