import clsx from "clsx";
import { GitBranch, GitFork } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AvatarProps {
  placeholder?: boolean;
  size?: number;
  src?: string;
  alt?: string;
  initials?: string;
}

export function Avatar({ placeholder = false, size = 24, src, alt = "", initials }: AvatarProps) {
  if (placeholder) return <Skeleton rounded height={size} width={size} className="border border-gray-alpha-400" />;
  return <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-alpha-400 bg-neutral-fill text-xs font-semibold text-on-surface" style={{ width: size, height: size }}>
    {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <span aria-label={alt || undefined}>{initials}</span>}
  </span>;
}

interface GitAvatarProps {
  username?: string;
  size?: number;
  src?: string;
}

function ProviderAvatar({ username, size = 24, src, provider }: GitAvatarProps & { provider: "GitHub" | "GitLab" | "Bitbucket" }) {
  return <span className="relative inline-flex" style={{ width: size, height: size }}>
    <Avatar size={size} src={src} alt={username ? `Avatar for ${username}` : ""} />
    <span aria-label={provider} className={clsx("absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-background", provider === "GitHub" ? "bg-white text-black" : provider === "GitLab" ? "bg-[#6b4fbb] text-white" : "bg-[#0052cc] text-white")}>
      {provider === "GitHub" ? <GitFork size={12} aria-hidden="true" /> : <GitBranch size={11} aria-hidden="true" />}
    </span>
  </span>;
}

export function GitHubAvatar(props: GitAvatarProps) { return <ProviderAvatar {...props} provider="GitHub" />; }
export function GitLabAvatar(props: GitAvatarProps) { return <ProviderAvatar {...props} provider="GitLab" />; }
export function BitbucketAvatar(props: GitAvatarProps) { return <ProviderAvatar {...props} provider="Bitbucket" />; }

interface AvatarGroupProps {
  members: { username?: string; src?: string; initials?: string }[];
  size?: number;
  limit?: number;
}

export function AvatarGroup({ members, size = 32, limit = 3 }: AvatarGroupProps) {
  const visible = members.slice(0, Math.max(0, limit));
  const remaining = members.length - visible.length;
  return <div className="flex items-center" aria-label={`${members.length} anggota`}>
    {visible.map((member, index) => <span key={`${member.username ?? member.src ?? "member"}-${index}`} className={clsx("inline-flex", index > 0 && "-ml-2")} style={{ zIndex: visible.length - index }} title={member.username}>
      <Avatar size={size} src={member.src} initials={member.initials} alt={member.username ?? ""} />
    </span>)}
    {remaining > 0 && <span className="-ml-2 inline-flex items-center justify-center rounded-full border border-gray-alpha-400 bg-gray-100 text-xs font-semibold text-gray-1000" style={{ width: size, height: size }} aria-label={`${remaining} anggota lainnya`}>+{remaining}</span>}
  </div>;
}
