import { interestLabel } from "@/lib/profile/interests";
import type { PublicProfile } from "@/lib/profile/types";

const GENDER_RU: Record<string, string> = { male: "М", female: "Ж", other: "—" };

export function ProfileView({ profile }: { profile: PublicProfile }) {
  const meta = [
    profile.age != null ? `${profile.age}` : null,
    profile.gender ? GENDER_RU[profile.gender] : null,
    profile.city,
  ]
    .filter(Boolean)
    .join(" · ");
  const hasAny = profile.bio || meta || profile.interests.length > 0 || profile.photos.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-col gap-4">
      {profile.photos.length > 0 && (
        <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {profile.photos.map((p, i) => (
            <img
              key={p.id}
              src={p.url}
              alt=""
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
              className="h-72 w-56 shrink-0 snap-center rounded-3xl border border-border object-cover animate-[fadeRise_260ms_ease-out] [animation-fill-mode:backwards]"
            />
          ))}
        </div>
      )}
      {meta && <p className="text-sm font-medium text-muted tabular-nums">{meta}</p>}
      {profile.bio && <p className="text-sm leading-relaxed text-foreground">{profile.bio}</p>}
      {profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((s) => (
            <span key={s} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {interestLabel(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
