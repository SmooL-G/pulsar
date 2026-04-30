export type ProfileBgId = 'aurora' | 'sunset' | 'ocean' | 'midnight' | 'rose' | 'forest';

export const PROFILE_BG: Record<ProfileBgId, string> = {
  aurora: 'linear-gradient(135deg, #34D399 0%, #06B6D4 50%, #8B5CF6 100%)',
  sunset: 'linear-gradient(135deg, #FBBF24 0%, #F97316 50%, #DC2626 100%)',
  ocean: 'linear-gradient(135deg, #0EA5E9 0%, #1E40AF 100%)',
  midnight: 'linear-gradient(135deg, #1E1B4B 0%, #581C87 50%, #1E1B4B 100%)',
  rose: 'linear-gradient(135deg, #F472B6 0%, #DB2777 50%, #831843 100%)',
  forest: 'linear-gradient(135deg, #16A34A 0%, #166534 100%)',
};

export const ALL_BGS: ProfileBgId[] = ['aurora', 'sunset', 'ocean', 'midnight', 'rose', 'forest'];

export function profileBgStyle(bg: string | null | undefined): React.CSSProperties | undefined {
  if (!bg || !(bg in PROFILE_BG)) return undefined;
  return { background: PROFILE_BG[bg as ProfileBgId] };
}
