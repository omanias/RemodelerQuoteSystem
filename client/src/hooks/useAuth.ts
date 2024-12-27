import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

export type AuthUser = {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
};

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["/api/auth/user", firebaseUser?.uid],
    queryFn: async () => {
      if (!firebaseUser) return null;

      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/auth/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<AuthUser>;
    },
    enabled: !!firebaseUser,
  });

  return {
    user,
    loading: isInitializing || isUserLoading,
    isAuthenticated: !!user,
  };
}