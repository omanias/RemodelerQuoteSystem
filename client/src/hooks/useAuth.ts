import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/contexts/AuthContext";

export type AuthUser = {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
};

export function useAuth() {
  const { firebaseUser, isLoading: isFirebaseLoading } = useFirebaseAuth();

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
    loading: isFirebaseLoading || isUserLoading,
    isAuthenticated: !!user,
  };
}