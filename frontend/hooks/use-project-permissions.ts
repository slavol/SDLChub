"use client";

import { useEffect, useState } from "react";

import { getMyProjectPermissions, type MyProjectPermissions } from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";

type PermissionState = MyProjectPermissions & {
  projectId: number;
  userId: number;
};

export function useProjectPermissions(projectId?: number | null) {
  const user = useAuthStore((state) => state.user);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  useEffect(() => {
    if (!projectId || !user?.id) {
      return;
    }

    let cancelled = false;
    const requestedProjectId = projectId;
    const requestedUserId = user.id;

    getMyProjectPermissions(requestedProjectId)
      .then((remotePermissions) => {
        if (!cancelled) {
          setPermissionState({
            ...remotePermissions,
            projectId: requestedProjectId,
            userId: requestedUserId,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionState(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id]);

  const isCurrentPermissionState =
    Boolean(projectId && user?.id) &&
    permissionState?.projectId === projectId &&
    permissionState?.userId === user?.id;

  const can = (permissionKey: string) =>
    Boolean(
      isCurrentPermissionState &&
        permissionState &&
        (permissionState.is_project_owner ||
          permissionState.is_project_admin ||
          permissionState.permissions?.[permissionKey])
    );

  return {
    can,
    membership: isCurrentPermissionState ? permissionState : null,
    permissions: isCurrentPermissionState ? permissionState?.permissions || {} : {},
    isProjectOwner: Boolean(isCurrentPermissionState && permissionState?.is_project_owner),
    isProjectAdmin: Boolean(isCurrentPermissionState && permissionState?.is_project_admin),
  };
}
