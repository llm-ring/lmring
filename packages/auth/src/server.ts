/**
 * Server-side authentication instance
 */

import { generateId } from '@better-auth/core/utils/id';
import { betterAuth } from 'better-auth/minimal';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import {
  db,
  users,
  session,
  account,
  verification,
  syncUserProviderIdFromAccount,
} from '@lmring/database';
import { getAuthConfig } from './config';
import { UserStatus } from './status';
import type { AuthLogger } from './logger';
import { authLogger as defaultLogger } from './logger';
import { AuthErrorCodes, createAuthError } from './errors';
import { validatePassword } from './password-validation';
import { createEmailService } from './email';

interface CreateAuthOptions {
  deploymentMode: 'saas' | 'selfhost';
  baseURL: string;
  secret: string;
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  linuxdoClientId?: string;
  linuxdoClientSecret?: string;
  linuxdoAuthEnabled?: boolean;
  emailEnabled?: boolean;
  resendApiKey?: string;
  emailFrom?: string;
  logger?: AuthLogger;
}

export function createAuth(options: CreateAuthOptions) {
  const logger = options.logger || defaultLogger;
  type AccountRecord = typeof account.$inferSelect;
  type OAuthProviderId = 'github' | 'google' | 'linuxdo';

  const isSupportedProvider = (providerId: string): providerId is OAuthProviderId =>
    providerId === 'github' || providerId === 'google' || providerId === 'linuxdo';

  const syncProviderIdForUser = async (userId: string, providerId: OAuthProviderId, source: string) => {
    try {
      const synced = await syncUserProviderIdFromAccount(userId, providerId);
      if (synced) {
        logger.debug('Synced OAuth provider id to user record', {
          source,
          userId,
          providerId,
        });
      } else {
        logger.warn('No OAuth account record found for user during provider sync', {
          source,
          userId,
          providerId,
        });
      }
    } catch (error) {
      logger.error('Failed to sync OAuth provider id to user record', {
        source,
        userId,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const syncProviderIdFromAccountRecord = async (
    accountRecord: AccountRecord | null | undefined,
    source: string,
  ) => {
    if (!accountRecord || !isSupportedProvider(accountRecord.providerId)) return;

    await syncProviderIdForUser(accountRecord.userId, accountRecord.providerId, source);
  };

  logger.info('Initializing Better-Auth server instance', {
    deploymentMode: options.deploymentMode,
  });

  try {
    const config = getAuthConfig({ ...options, logger });

    logger.info('Creating database adapter', {
      provider: 'pg',
    });

    const betterAuthConfig = {
      ...config,
      database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
          user: users,
          session: session,
          account: account,
          verification: verification,
        },
      }),
      advanced: {
        database: {
          generateId: (options: { model: string; size?: number }) => {
            // Let database generate UUID for user IDs
            if (options.model === 'user') return undefined;
            // For other tables, use Better-Auth's generator
            return options.size ? generateId(options.size) : generateId();
          },
        },
      },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        autoSignIn: true,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
        freshAge: 60 * 10, // 10 minutes
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ['github', 'google', 'linuxdo'],
        },
      },
      user: {
        fields: {
          name: 'fullName',
          image: 'avatarUrl',
          emailVerified: 'emailVerified',
        },
        additionalFields: {
          username: {
            type: 'string',
            required: false,
            input: false,
          },
          githubId: {
            type: 'string',
            required: false,
            input: false,
          },
          googleId: {
            type: 'string',
            required: false,
            input: false,
          },
          linuxdoId: {
            type: 'string',
            required: false,
            input: false,
          },
          inviterId: {
            type: 'string',
            required: false,
            input: false,
          },
          deletedAt: {
            type: 'date',
            required: false,
            input: false,
          },
          role: {
            type: 'string',
            defaultValue: 'user',
            required: true,
          },
          status: {
            type: 'string',
            defaultValue: 'active',
            required: true,
          },
        },
      },
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (ctx.path === '/sign-up/email' && ctx.method === 'POST') {
            const password = (ctx.body as { password?: string })?.password;
            if (password) {
              const validation = validatePassword(password);
              if (!validation.valid) {
                logger.warn('Password validation failed during sign-up', {
                  path: ctx.path,
                  errors: validation.errors,
                });
                throw createAuthError(AuthErrorCodes.WEAK_PASSWORD, validation.errors.join('; '));
              }
            }
          }

          if (
            ctx.path === '/sign-in/email' ||
            ctx.path === '/sign-in/social' ||
            ctx.path?.includes('/callback')
          ) {
            logger.debug('Authentication attempt started', {
              path: ctx.path,
              method: ctx.method,
              body: ctx.body,
            });
          }
        }),
        after: createAuthMiddleware(async (ctx) => {
          if (
            ctx.path === '/sign-in/email' ||
            ctx.path === '/sign-in/social' ||
            ctx.path?.includes('/callback')
          ) {
            const sessionInfo = ctx.context.newSession ?? ctx.context.session;

            if (sessionInfo?.user) {
              const user = sessionInfo.user as any;

              logger.debug('User authentication successful, checking status', {
                userId: user.id,
                status: user.status,
                role: user.role,
              });

              if (user.status === UserStatus.DISABLED) {
                logger.warn('Disabled user attempted to sign in', {
                  userId: user.id,
                  status: user.status,
                  errorCode: AuthErrorCodes.USER_DISABLED,
                });
                throw createAuthError(AuthErrorCodes.USER_DISABLED);
              }

              if (user.status === UserStatus.PENDING) {
                logger.warn('Pending user attempted to sign in', {
                  userId: user.id,
                  status: user.status,
                  errorCode: AuthErrorCodes.USER_PENDING,
                });
                throw createAuthError(AuthErrorCodes.USER_PENDING);
              }

              if (user.status === UserStatus.ACTIVE) {
                logger.info('User signed in successfully', {
                  userId: user.id,
                  role: user.role,
                  status: user.status,
                  provider: ctx.path?.includes('social') ? 'oauth' : 'email',
                });

                // When returning from an OAuth callback, mirror provider account id onto user record
                // This keeps users.githubId/googleId in sync for app code that relies on these fields
                if (ctx.path?.includes('/callback')) {
                  const isGithub = ctx.path.includes('/callback/github');
                  const isGoogle = ctx.path.includes('/callback/google');
                  const isLinuxdo = ctx.path.includes('/callback/linuxdo');

                  const providerId = isGithub ? 'github' : isGoogle ? 'google' : isLinuxdo ? 'linuxdo' : undefined;

                  if (providerId) {
                    await syncProviderIdForUser(user.id, providerId, 'middleware:callback');
                  }
                }
              }
            } else {
              logger.debug('Authentication attempt completed without user context', {
                path: ctx.path,
              });
            }
          }
        }),
      },
      databaseHooks: {
        account: {
          create: {
            after: async (createdAccount: AccountRecord) => {
              await syncProviderIdFromAccountRecord(
                createdAccount as AccountRecord | null | undefined,
                'databaseHook:create',
              );
            },
          },
          update: {
            after: async (updatedAccount: AccountRecord) => {
              await syncProviderIdFromAccountRecord(
                updatedAccount as AccountRecord | null | undefined,
                'databaseHook:update',
              );
            },
          },
        },
      },
      plugins: [] as any[],
    };

    // Add Linux.do OAuth plugin if enabled
    if (config.linuxdoConfig) {
      betterAuthConfig.plugins.push(
        genericOAuth({
          config: [
            {
              providerId: 'linuxdo',
              clientId: config.linuxdoConfig.clientId,
              clientSecret: config.linuxdoConfig.clientSecret,
              authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
              tokenUrl: 'https://connect.linux.do/oauth2/token',
              userInfoUrl: 'https://connect.linux.do/api/user',
              scopes: ['user'],
              getToken: async ({ code, redirectURI, codeVerifier }) => {
                logger.debug('Linux.do token exchange request', {
                  tokenUrl: 'https://connect.linux.do/oauth2/token',
                  redirectURI,
                  hasCode: !!code,
                  hasCodeVerifier: !!codeVerifier,
                });

                const body = new URLSearchParams({
                  grant_type: 'authorization_code',
                  code,
                  redirect_uri: redirectURI,
                  client_id: config.linuxdoConfig.clientId,
                  client_secret: config.linuxdoConfig.clientSecret,
                });

                let response: Response;
                try {
                  response = await fetch('https://connect.linux.do/oauth2/token', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      Accept: 'application/json',
                    },
                    body,
                  });
                } catch (fetchError) {
                  const cause =
                    fetchError instanceof Error ? (fetchError as any).cause : undefined;
                  logger.error('Linux.do token exchange network error', {
                    error:
                      fetchError instanceof Error ? fetchError.message : 'Unknown error',
                    cause: cause instanceof Error ? cause.message : undefined,
                    code: cause?.code,
                    redirectURI,
                  });
                  throw new Error(
                    `Token exchange failed: network error (${cause instanceof Error ? cause.message : 'fetch failed'})`,
                  );
                }

                const responseText = await response.text();

                let data: any;
                try {
                  data = JSON.parse(responseText);
                } catch {
                  logger.error('Linux.do token exchange returned non-JSON response', {
                    status: response.status,
                    body: responseText.slice(0, 500),
                    redirectURI,
                  });
                  throw new Error(`Token exchange failed: non-JSON response (status ${response.status})`);
                }

                if (!response.ok) {
                  logger.error('Linux.do token exchange failed', {
                    status: response.status,
                    error: data.error,
                    errorDescription: data.error_description,
                    redirectURI,
                  });
                  throw new Error(`Token exchange failed: ${data.error} - ${data.error_description}`);
                }

                logger.debug('Linux.do token exchange successful');

                return {
                  accessToken: data.access_token,
                  refreshToken: data.refresh_token,
                  accessTokenExpiresAt: data.expires_in
                    ? new Date(Date.now() + data.expires_in * 1000)
                    : undefined,
                  tokenType: data.token_type,
                  scopes: data.scope ? data.scope.split(' ') : [],
                  raw: data,
                };
              },
              mapProfileToUser: (profile: any) => {
                // Avatar template format: /user_avatar/linux.do/{username}/{size}/xxx.png
                const avatarUrl = profile.avatar_template
                  ? `https://linux.do${profile.avatar_template.replace('{size}', '200')}`
                  : undefined;

                return {
                  // Linux.do doesn't provide email - user must add after login
                  // Use a placeholder that will be detected and require completion
                  email: `linuxdo_${profile.id}@placeholder.local`,
                  name: profile.name || profile.username,
                  image: avatarUrl,
                };
              },
            },
          ],
        })
      );
      logger.info('Linux.do OAuth plugin configured');
    }

    // Add Email OTP plugin if enabled
    if (config.emailConfig) {
      const emailService = createEmailService({
        resendApiKey: config.emailConfig.resendApiKey,
        emailFrom: config.emailConfig.emailFrom,
      }, logger);

      betterAuthConfig.plugins.push(
        emailOTP({
          otpLength: 6,
          expiresIn: 600, // 10 minutes
          allowedAttempts: 5,
          async sendVerificationOTP({ email, otp, type }) {
            const result = await emailService.sendOTP({ email, otp, type });
            if (!result.success) {
              throw new Error(result.error || 'Failed to send verification email');
            }
          },
        })
      );
      logger.info('Email OTP plugin configured');
    }

    const auth = betterAuth(betterAuthConfig);

    logger.info('Better-Auth server instance created successfully', {
      sessionExpiresIn: '7 days',
      sessionUpdateAge: '1 day',
      sessionFreshAge: '10 minutes',
      emailPasswordEnabled: true,
      accountLinkingEnabled: true,
      linuxdoOAuthEnabled: !!config.linuxdoConfig,
      emailOTPEnabled: !!config.emailConfig,
    });

    return auth;
  } catch (error) {
    logger.error('Failed to create Better-Auth server instance', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session'];
