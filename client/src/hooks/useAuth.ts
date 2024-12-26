import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { useQuery } from "@tanstack/react-query";

export type AuthUser = {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
};

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    console.log("Setting up Firebase auth listener");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Firebase auth state changed:", user?.email);
      setFirebaseUser(user);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const { data: user, isLoading: isUserLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    queryFn: async () => {
      console.log("Fetching user data for:", firebaseUser?.email);
      const token = await firebaseUser?.getIdToken();
      const res = await fetch("/api/auth/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error fetching user data:", errorText);
        throw new Error(errorText);
      }
      const userData = await res.json();
      console.log("User data received:", userData);
      return userData;
    },
  });

  return {
    user,
    firebaseUser,
    loading: !authChecked || (!!firebaseUser && isUserLoading),
    error,
    isAuthenticated: !!user,
  };
}