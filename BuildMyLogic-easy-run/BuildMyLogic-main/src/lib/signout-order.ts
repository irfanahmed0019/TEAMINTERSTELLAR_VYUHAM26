/** Revoke local cloud-write authority before clearing learner state or awaiting I/O. */
export async function signOutInOrder(actions: {
  revoke: () => void;
  remote: () => Promise<unknown>;
  clear: () => void;
}): Promise<void> {
  actions.revoke();
  actions.clear();
  await actions.remote();
}
