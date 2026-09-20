"use client";

import { createContext, useContext } from "react";

export interface ClientUser {
  id: number;
  username: string;
}

const UserContext = createContext<ClientUser | null>(null);

export function UserProvider({ user, children }: { user: ClientUser | null; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

/** The signed-in user, or null when logged out. */
export function useUser(): ClientUser | null {
  return useContext(UserContext);
}
