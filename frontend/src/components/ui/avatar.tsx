import clsx from "clsx";
import Image from "next/image";

interface AvatarProps {
  size: number;
  src?: string;
  alt: string;
  initials?: string;
}

function Avatar({ size, src, alt, initials }: AvatarProps) {
  return <span className="avatar-chip" style={{ width: size, height: size }}>
    {src ? <Image src={src} alt={alt} width={size} height={size} unoptimized /> : <span aria-label={alt || undefined}>{initials}</span>}
  </span>;
}

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
    {remaining > 0 && <span className="avatar-chip -ml-2" style={{ width: size, height: size }} aria-label={`${remaining} anggota lainnya`}>+{remaining}</span>}
  </div>;
}
