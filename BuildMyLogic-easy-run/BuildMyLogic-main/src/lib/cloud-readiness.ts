/** Nonpersistent owner hydration marker. A save during unread/failed restore is forbidden. */
let owner: string | null = null;
export function setReadyCloudOwner(uid: string | null) {
  owner = uid;
}
export function isReadyCloudOwner(uid: string) {
  return owner === uid;
}
