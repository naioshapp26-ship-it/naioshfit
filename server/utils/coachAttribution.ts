// Minimal local types to avoid importing the full storage/schema during isolated use
export type BasicUser = {
  id: number;
  role: string;
  isApproved?: boolean | null;
  coachId?: number | null;
};

export type MinimalStorage = {
  getUser(id: number): Promise<BasicUser | undefined>;
  updateUser(id: number, user: Partial<BasicUser>): Promise<BasicUser | undefined>;
};

// Resolve a valid coachId from any raw input. Returns the coachId if the user exists,
// is a coach, and is approved. Otherwise returns undefined.
export async function resolveValidCoachId(storage: MinimalStorage, rawCoachId: any): Promise<number | undefined> {
  try {
    if (rawCoachId === undefined || rawCoachId === null) return undefined;
    const str = String(rawCoachId);
    if (!/^\d+$/.test(str)) return undefined;
    const id = parseInt(str, 10);
    if (!(id > 0)) return undefined;
    const coach = await storage.getUser(id);
    if (coach && coach.role === 'coach' && coach.isApproved === true) {
      return id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function resolveValidGymId(storage: MinimalStorage, rawGymId: any): Promise<number | undefined> {
  try {
    if (rawGymId === undefined || rawGymId === null) return undefined;
    const str = String(rawGymId);
    if (!/^\d+$/.test(str)) return undefined;
    const id = parseInt(str, 10);
    if (!(id > 0)) return undefined;
    const gym = await storage.getUser(id);
    
    if (gym && gym.role === 'gym') {
      return id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Apply attribution safely on a newly created user (only if role is 'user' and no coachId set).
export async function applyCoachAttributionIfValid(storage: MinimalStorage, newUser: BasicUser, coachId: number | undefined): Promise<BasicUser> {
  if (!coachId) return newUser;
  if (newUser.role !== 'user') return newUser; // don't attribute coaches/admins
  if ((newUser as any).coachId) return newUser; // don't override if set
  try {
    const updated = await storage.updateUser(newUser.id, { coachId });
    return updated || newUser;
  } catch {
    return newUser; // non-fatal
  }
}

// Apply gym attribution safely on a newly created coach (only if role is 'coach' and no gymId set).
export async function applyGymAttributionIfValid(storage: MinimalStorage, newUser: BasicUser, gymId: number | undefined): Promise<BasicUser> {
  if (!gymId) return newUser;
  if (newUser.role !== 'coach') return newUser; // only apply to coaches
  if ((newUser as any).gymId) return newUser; // don't override if already set
  try {
    const updated = await storage.updateUser(newUser.id, { gymId });
    return updated || newUser;
  } catch {
    return newUser; // non-fatal
  }
}
