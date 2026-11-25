/**
 * Client-side authentication hooks and utilities
 */

'use client';

import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

interface CreateAuthClientOptions {
  baseURL: string;
}

export function createClient(options: CreateAuthClientOptions) {
  const authClient = createAuthClient({
    baseURL: options.baseURL,
    plugins: [emailOTPClient()],
  });

  return authClient;
}
