// web/src/ui/primitives/elements/avatar.tsx
// Orbit Avatar primitive with safe name fallback.

import {
  Avatar as OrbitAvatar,
  type AvatarProps as OrbitAvatarProps,
} from "@polar-sh/orbit/Avatar";

export interface AvatarProps
  extends Omit<OrbitAvatarProps, "name" | "avatar_url"> {
  name?: string | null;
  avatar_url?: string | null;
}

export function Avatar({
  name = "",
  avatar_url = null,
  ...props
}: AvatarProps) {
  return (
    <OrbitAvatar
      data-slot="avatar"
      name={name ?? ""}
      avatar_url={avatar_url ?? null}
      {...props}
    />
  );
}
