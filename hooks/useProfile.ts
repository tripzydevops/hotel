import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminUser } from "@/types";

export function useProfile(userId: string | null) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId!),
    enabled: !!userId,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (profile: Partial<AdminUser>) =>
      api.updateProfile(userId!, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const setProfile = (newProfile: AdminUser) => {
    queryClient.setQueryData(["profile", userId], newProfile);
  };

  return {
    profile: profileQuery.data || null,
    loading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: (profile: Partial<AdminUser>) =>
      updateProfileMutation.mutateAsync(profile),
    setProfile, // Exposed for legacy support or manual cache updates
    isUpdating: updateProfileMutation.isPending,
  };
}
