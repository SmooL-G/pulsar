import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  PROPOSAL_DEPOSIT,
  MIN_BALANCE_TO_CREATE,
  MIN_VERIFICATION_LEVEL,
  VOTING_PERIOD_DAYS,
  QUORUM_VOTES,
  VOTE_REWARD,
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  isTreasuryEnabled,
  setTreasuryEnabled,
  createProposal,
  castVote,
  TreasuryError,
} from './treasury.service.js';

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  nickColor: true,
  avatarFrame: true,
  bubbleColor: true,
  verificationLevel: true,
} as const;

function serialize(p: any, author: any | null, myChoice: 'yes' | 'no' | null) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    deposit: p.deposit.toString(),
    yesPower: p.yesPower.toString(),
    noPower: p.noPower.toString(),
    voterCount: p.voterCount,
    quorum: QUORUM_VOTES,
    startedAt: p.startedAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    resolvedAt: p.resolvedAt?.toISOString() ?? null,
    author,
    myChoice,
  };
}

export async function treasuryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/config', async () => ({
    enabled: await isTreasuryEnabled(),
    deposit: PROPOSAL_DEPOSIT.toString(),
    minBalance: MIN_BALANCE_TO_CREATE.toString(),
    minVerificationLevel: MIN_VERIFICATION_LEVEL,
    votingPeriodDays: VOTING_PERIOD_DAYS,
    quorum: QUORUM_VOTES,
    voteReward: VOTE_REWARD.toString(),
    titleMin: TITLE_MIN,
    titleMax: TITLE_MAX,
    descriptionMin: DESCRIPTION_MIN,
    descriptionMax: DESCRIPTION_MAX,
  }));

  app.get<{ Querystring: { status?: string; limit?: string } }>('/proposals', async (request) => {
    const userId = request.user!.userId;
    const status = request.query.status;
    const limit = Math.min(parseInt(request.query.limit ?? '50', 10) || 50, 100);

    const proposals = await prisma.proposal.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: [{ status: 'asc' }, { endsAt: 'desc' }],
      take: limit,
    });

    const authorIds = Array.from(new Set(proposals.map((p) => p.authorId)));
    const authors = authorIds.length
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: userSelect })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const myVotes = proposals.length
      ? await prisma.proposalVote.findMany({
          where: { userId, proposalId: { in: proposals.map((p) => p.id) } },
          select: { proposalId: true, choice: true },
        })
      : [];
    const voteMap = new Map(myVotes.map((v) => [v.proposalId, v.choice as 'yes' | 'no']));

    return {
      proposals: proposals.map((p) =>
        serialize(p, authorMap.get(p.authorId) ?? null, voteMap.get(p.id) ?? null),
      ),
    };
  });

  app.get<{ Params: { id: string } }>('/proposals/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const p = await prisma.proposal.findUnique({ where: { id: request.params.id } });
    if (!p) return reply.status(404).send({ error: 'NOT_FOUND' });
    const author = await prisma.user.findUnique({ where: { id: p.authorId }, select: userSelect });
    const my = await prisma.proposalVote.findUnique({
      where: { proposalId_userId: { proposalId: p.id, userId } },
    });
    return { proposal: serialize(p, author, (my?.choice as 'yes' | 'no') ?? null) };
  });

  app.post<{ Body: { title: string; description: string } }>('/proposals', async (request, reply) => {
    const userId = request.user!.userId;
    const { title, description } = request.body ?? ({} as any);
    if (typeof title !== 'string' || typeof description !== 'string') {
      return reply.status(400).send({ error: 'BAD_INPUT' });
    }
    try {
      const p = await createProposal(userId, title, description);
      return reply.status(201).send({ proposal: serialize(p, null, null) });
    } catch (err) {
      if (err instanceof TreasuryError) {
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post<{ Params: { id: string }; Body: { choice: 'yes' | 'no' } }>(
    '/proposals/:id/vote',
    async (request, reply) => {
      const userId = request.user!.userId;
      const choice = request.body?.choice;
      if (choice !== 'yes' && choice !== 'no') {
        return reply.status(400).send({ error: 'BAD_INPUT' });
      }
      try {
        const result = await castVote(request.params.id, userId, choice);
        return result;
      } catch (err) {
        if (err instanceof TreasuryError) {
          const status =
            err.code === 'NOT_FOUND' ? 404 : err.code === 'ALREADY_VOTED' ? 409 : 400;
          return reply.status(status).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  // Admin toggle
  app.post<{ Body: { enabled: boolean } }>('/toggle', async (request, reply) => {
    const me = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { role: true },
    });
    if (me?.role !== 'ADMIN' && me?.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    const enabled = !!request.body?.enabled;
    await setTreasuryEnabled(enabled);
    return { enabled };
  });
}
