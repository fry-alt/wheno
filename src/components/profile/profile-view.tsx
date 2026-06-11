import { interestLabel } from "@/lib/profile/interests";
import type { PublicProfile } from "@/lib/profile/types";

const GENDER_RU: Record<string, string> = { male: "М", female: "Ж", other: "—" };

export function ProfileView({ profile }: { profile: PublicProfile }) {
  const hasAny =
    profile.bio || profile.city || profile.age != null || profile.interests.length > 0 || profile.photos.length > 0;
  if (!hasAny) return null;
  return (
    <div className="flex flex-col gap-4">
      {profile.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {profile.photos.map((p) => (
            <img key={p.id} src={p.url} alt="" className="h-40 w-32 flex-shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}
      {(profile.age != null || profile.gender || profile.city) && (
        <p className="text-sm text-muted tabular-nums">
          {[profile.age != null ? `${profile.age}` : null, profile.gender ? GENDER_RU[profile.gender] : null, profile.city]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
      {profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((s) => (
            <span key={s} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">
              {interestLabel(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
