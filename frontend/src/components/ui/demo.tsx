import { Avatar, AvatarGroup } from "@/components/ui/avatar";

export function Group() {
  return <div className="flex flex-col gap-2">
    <h2>Group</h2>
    <AvatarGroup size={32} members={[
      { username: "evilrabbit", src: "https://vercel.com/api/www/avatar?u=evilrabbit&s=64" },
      { username: "leerob", src: "https://vercel.com/api/www/avatar?u=leerob&s=64" },
      { username: "rauchg", src: "https://cdn.21st.dev/assets/mirror/f4/f4717d0b7a61f81945fa88eb7852b830d4dbd06634363e943498ff10dc846b14.jpg" },
    ]} />
    <AvatarGroup size={32} limit={4} members={[
      { username: "sambecker", src: "https://vercel.com/api/www/avatar?u=sambecker&s=64" },
      { username: "rauno", src: "https://vercel.com/api/www/avatar?u=rauno&s=64" },
      { username: "shuding", src: "https://vercel.com/api/www/avatar?u=shuding&s=64" },
      { username: "skllcrn" },
      { username: "almonk" },
    ]} />
  </div>;
}

export function Placeholder() {
  return <div className="flex flex-col gap-2"><h2>Placeholder</h2><Avatar placeholder size={90} /></div>;
}
