import { describe, expect, it } from 'vitest';
import { createTableRelationsHelpers, extractTablesRelationalConfig } from 'drizzle-orm';
import * as schema from './schema';

/** Locate a drizzle internal symbol by name fragment. */
function getDrizzleSymbol(obj: object, nameFragment: string): symbol | undefined {
  return Object.getOwnPropertySymbols(obj).find((s) => s.toString().includes(nameFragment));
}

/** Table exports (exclude relations, enums, and pure type re-exports). */
const TABLE_EXPORTS = [
  'users',
  'userPreferences',
  'apiKeys',
  'userEnabledModels',
  'userCustomModels',
  'userModelOverrides',
  'conversations',
  'messages',
  'modelResponses',
  'comparisonVotes',
  'comparisonVoteResults',
  'modelComparisonStats',
  'files',
  'sharedResults',
  'webdevSessions',
  'webdevResponses',
  'webdevIterations',
  'session',
  'account',
  'verification',
] as const;

const RELATION_EXPORTS = [
  'usersRelations',
  'userPreferencesRelations',
  'apiKeysRelations',
  'userEnabledModelsRelations',
  'userCustomModelsRelations',
  'userModelOverridesRelations',
  'conversationsRelations',
  'messagesRelations',
  'modelResponsesRelations',
  'comparisonVotesRelations',
  'comparisonVoteResultsRelations',
  'sharedResultsRelations',
  'webdevSessionsRelations',
  'webdevResponsesRelations',
  'webdevIterationsRelations',
  'sessionRelations',
  'accountRelations',
] as const;

describe('schema', () => {
  describe('enums', () => {
    it('exports config and user enums', () => {
      expect(schema.configSourceEnum).toBeDefined();
      expect(schema.roleEnum).toBeDefined();
      expect(schema.userRoleEnum).toBeDefined();
      expect(schema.userStatusEnum).toBeDefined();
      expect(schema.comparisonTypeEnum).toBeDefined();
      expect(schema.voteOutcomeEnum).toBeDefined();
      expect(schema.webdevStatusEnum).toBeDefined();
    });

    it('exposes expected enum values', () => {
      expect(schema.userStatusEnum.enumValues).toEqual(['active', 'disabled', 'pending']);
      expect(schema.userRoleEnum.enumValues).toEqual(['admin', 'user']);
      expect(schema.roleEnum.enumValues).toEqual(['user', 'assistant', 'system']);
      expect(schema.configSourceEnum.enumValues).toEqual([
        'manual',
        'cherry-studio',
        'newapi',
      ]);
      expect(schema.comparisonTypeEnum.enumValues).toEqual([
        'text',
        'image_gen',
        'video_gen',
        'tts',
        'stt',
      ]);
      expect(schema.voteOutcomeEnum.enumValues).toEqual([
        'winner',
        'loser',
        'tie',
        'all_bad',
      ]);
      expect(schema.webdevStatusEnum.enumValues).toEqual([
        'generating',
        'building',
        'ready',
        'error',
        'expired',
      ]);
    });
  });

  describe('core auth tables', () => {
    it('exports users, session, account, and verification tables', () => {
      expect(schema.users).toBeDefined();
      expect(schema.session).toBeDefined();
      expect(schema.account).toBeDefined();
      expect(schema.verification).toBeDefined();
    });

    it('defines expected columns on users', () => {
      expect(schema.users.id).toBeDefined();
      expect(schema.users.email).toBeDefined();
      expect(schema.users.fullName).toBeDefined();
      expect(schema.users.role).toBeDefined();
      expect(schema.users.status).toBeDefined();
      expect(schema.users.githubId).toBeDefined();
      expect(schema.users.googleId).toBeDefined();
      expect(schema.users.linuxdoId).toBeDefined();
      expect(schema.users.inviterId).toBeDefined();
      expect(schema.users.deletedAt).toBeDefined();
    });

    it('defines expected columns on session', () => {
      expect(schema.session.id).toBeDefined();
      expect(schema.session.userId).toBeDefined();
      expect(schema.session.token).toBeDefined();
      expect(schema.session.expiresAt).toBeDefined();
    });

    it('defines expected columns on account', () => {
      expect(schema.account.id).toBeDefined();
      expect(schema.account.userId).toBeDefined();
      expect(schema.account.accountId).toBeDefined();
      expect(schema.account.providerId).toBeDefined();
      expect(schema.account.password).toBeDefined();
    });

    it('defines expected columns on verification', () => {
      expect(schema.verification.id).toBeDefined();
      expect(schema.verification.identifier).toBeDefined();
      expect(schema.verification.value).toBeDefined();
      expect(schema.verification.expiresAt).toBeDefined();
    });
  });

  describe('application tables', () => {
    it('exports preference and key management tables', () => {
      expect(schema.userPreferences).toBeDefined();
      expect(schema.apiKeys).toBeDefined();
      expect(schema.userEnabledModels).toBeDefined();
      expect(schema.userCustomModels).toBeDefined();
      expect(schema.userModelOverrides).toBeDefined();
    });

    it('exports conversation and messaging tables', () => {
      expect(schema.conversations).toBeDefined();
      expect(schema.messages).toBeDefined();
      expect(schema.modelResponses).toBeDefined();
      expect(schema.files).toBeDefined();
      expect(schema.sharedResults).toBeDefined();
    });

    it('exports comparison / voting tables', () => {
      expect(schema.comparisonVotes).toBeDefined();
      expect(schema.comparisonVoteResults).toBeDefined();
      expect(schema.modelComparisonStats).toBeDefined();
    });

    it('exports webdev tables', () => {
      expect(schema.webdevSessions).toBeDefined();
      expect(schema.webdevResponses).toBeDefined();
      expect(schema.webdevIterations).toBeDefined();
    });
  });

  describe('table extra config builders', () => {
    it('invokes ExtraConfigBuilder for every table to cover index/unique definitions', () => {
      for (const tableName of TABLE_EXPORTS) {
        const table = schema[tableName] as object;
        const builderSym = getDrizzleSymbol(table, 'ExtraConfigBuilder');
        const colsSym = getDrizzleSymbol(table, 'ExtraConfigColumns');

        expect(builderSym, `${tableName} ExtraConfigBuilder`).toBeDefined();
        expect(colsSym, `${tableName} ExtraConfigColumns`).toBeDefined();

        const builder = (table as Record<symbol, unknown>)[builderSym!] as
          | ((cols: unknown) => unknown)
          | undefined;
        const cols = (table as Record<symbol, unknown>)[colsSym!];

        expect(typeof builder).toBe('function');
        const result = builder!(cols);
        expect(Array.isArray(result), `${tableName} extra config returns array`).toBe(true);
        expect((result as unknown[]).length).toBeGreaterThan(0);
      }
    });

    it('resolves inline foreign key references on all tables', () => {
      let fkCount = 0;

      for (const tableName of TABLE_EXPORTS) {
        const table = schema[tableName] as object;
        const fksSym = getDrizzleSymbol(table, 'PgInlineForeignKeys');
        if (!fksSym) continue;

        const fks = (table as Record<symbol, unknown>)[fksSym] as Array<{
          reference?: () => unknown;
        }>;
        if (!Array.isArray(fks)) continue;

        for (const fk of fks) {
          if (typeof fk.reference === 'function') {
            const ref = fk.reference();
            expect(ref).toBeDefined();
            fkCount += 1;
          }
        }
      }

      // Schema has many FK references; ensure we exercised a meaningful set
      expect(fkCount).toBeGreaterThan(10);
    });
  });

  describe('relations', () => {
    it('exports relation objects for major tables', () => {
      for (const name of RELATION_EXPORTS) {
        expect(schema[name], name).toBeDefined();
      }
    });

    it('invokes each relation config callback', () => {
      for (const name of RELATION_EXPORTS) {
        const relation = schema[name] as {
          table: object;
          config: (helpers: ReturnType<typeof createTableRelationsHelpers>) => Record<string, unknown>;
        };

        expect(typeof relation.config).toBe('function');
        const helpers = createTableRelationsHelpers(relation.table as never);
        const config = relation.config(helpers);
        expect(Object.keys(config).length).toBeGreaterThan(0);
      }
    });

    it('builds full relational config via extractTablesRelationalConfig', () => {
      const { tables, tableNamesMap } = extractTablesRelationalConfig(
        schema,
        createTableRelationsHelpers,
      );

      expect(Object.keys(tables).length).toBeGreaterThan(10);
      expect(tableNamesMap).toBeDefined();
      expect(tables.users).toBeDefined();
      expect(tables.conversations).toBeDefined();
      expect(tables.session).toBeDefined();
      expect(tables.account).toBeDefined();
    });
  });

  describe('type inference anchors', () => {
    it('table objects support drizzle $inferSelect style access', () => {
      expect(typeof schema.users).toBe('object');
      expect(typeof schema.conversations).toBe('object');
      expect(typeof schema.session).toBe('object');
      expect(typeof schema.account).toBe('object');
      expect(typeof schema.verification).toBe('object');
    });
  });
});
