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
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);

  useEffect(() => {
    // Handle Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setInitialAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const { data: user, isLoading: isUserLoading, error } = useQuery({
    queryKey: ["/api/auth/user", firebaseUser?.uid],
    enabled: !!firebaseUser,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    user,
    firebaseUser,
    loading: !initialAuthChecked || (!!firebaseUser && isUserLoading),
    error,
    isAuthenticated: !!user,
  };
}