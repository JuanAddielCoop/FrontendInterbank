export const normalizeUser = (entry, index = 0) => ({
  id: entry?.id ?? entry?.userId ?? entry?.userName ?? `user-${index}`,
  userName: entry?.userName ?? entry?.user ?? `Usuario ${index + 1}`,
  email: entry?.email ?? '',
  firstName: entry?.firstName ?? '',
  lastName: entry?.lastName ?? '',
  roles: Array.isArray(entry?.roles) ? entry.roles : [],
  isVerified: Boolean(entry?.isVerified ?? entry?.emailConfirmed ?? entry?.confirmed ?? false),
  isActive: entry?.isActive ?? entry?.active ?? true,
  createdAt: entry?.createdAt ?? entry?.dateCreated ?? null,
  lastLogin: entry?.lastLogin ?? entry?.lastAccess ?? null,
  raw: entry,
})

export const normalizeUsers = (entries = []) =>
  entries.map((entry, index) => normalizeUser(entry, index))
