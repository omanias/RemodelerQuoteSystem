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
      console.log("Firebase auth state changed:", user?.email);
      setFirebaseUser(user);
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      if (!firebaseUser) {
        console.log("No firebase user, returning null");
        return null;
      }

      try {
        const token = await firebaseUser.getIdToken();
        console.log("Got firebase token, fetching user data");

        const res = await fetch("/api/auth/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          console.error("Failed to fetch user data:", await res.text());
          throw new Error(await res.text());
        }

        const userData = await res.json() as AuthUser;
        console.log("Got user data:", userData);
        return userData;
      } catch (error) {
        console.error("Error fetching user data:", error);
        throw error;
      }
    },
    enabled: !!firebaseUser,
    retry: false,
  });

  return {
    user,
    loading: isInitializing || isUserLoading,
    isAuthenticated: !!user,
  };
}