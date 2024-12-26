import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type AuthUser = {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
};

export function useAuth() {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthChecked(true);
      if (user) {
        // Prefetch user data when Firebase auth changes
        queryClient.prefetchQuery({
          queryKey: ["/api/auth/user"],
        });
      }
    });
  }, [queryClient]);

  const { data: user, isLoading: isUserLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    user,
    firebaseUser,
    loading: !authChecked || (!!firebaseUser && isUserLoading),
    error,
    isAuthenticated: !!user,
  };
}