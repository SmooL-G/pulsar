/**
 * Prisma select fragment to include subscription state on a user, plus a
 * tiny helper to flatten it into a boolean `isPremium` field. Use both
 * together so frontend selectors don't have to know about the relation.
 *
 *   const user = await prisma.user.findUnique({
 *     where: { id }, select: { id: true, ...withPremiumSelect },
 *   });
 *   return mapPremium(user);
 */
export const withPremiumSelect = {
  subscription: { select: { expiresAt: true } },
} as const;

export function mapPremium<T extends { subscription?: { expiresAt: Date } | null } | null>(
  user: T,
): Omit<NonNullable<T>, 'subscription'> & { isPremium: boolean } | null {
  if (!user) return null as any;
  const isPremium = !!user.subscription && user.subscription.expiresAt.getTime() > Date.now();
  const { subscription: _drop, ...rest } = user as any;
  return { ...rest, isPremium };
}
