/**
 * Better-Auth client instance for client-side authentication
 */

'use client';

import { createClient } from '@lmring/auth/client';
import { getAuthBaseUrl } from '@/utils/Helpers';

export const authClient = createClient({
  baseURL: getAuthBaseUrl(),
});

// Export useSession hook from the auth client instance
export const { useSession } = authClient;
