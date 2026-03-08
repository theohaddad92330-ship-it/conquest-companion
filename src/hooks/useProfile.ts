import { useProfileContext } from "@/contexts/ProfileContext";

export type { Profile } from "@/contexts/ProfileContext";

export function useProfile() {
  const { profile, loading, updateProfile, refetch } = useProfileContext();
  return { profile, loading, updateProfile, refetch };
}
