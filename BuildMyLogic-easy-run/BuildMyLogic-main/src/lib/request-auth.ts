/** Recovery import is owner-scoped. A short extension session code is not owner identity. */
export function canReadRecoverySession(
  ownerId: string,
  authenticatedId: string | null | undefined,
  hostname: string,
  nodeEnv: string | undefined,
): boolean {
  const realOwner =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      ownerId,
    );
  if (realOwner) return authenticatedId === ownerId;
  return (
    ["localhost", "127.0.0.1"].includes(hostname) &&
    nodeEnv !== "production" &&
    ["local-builder", "local-user"].includes(ownerId)
  );
}
