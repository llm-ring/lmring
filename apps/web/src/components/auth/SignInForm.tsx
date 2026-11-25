'use client';

import { env } from '@lmring/env';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EyeIcon, EyeOffIcon, LinuxdoIcon } from '@/components/auth/AuthIcons';
import { useTranslations } from '@/hooks/use-translations';
import { authClient } from '@/libs/AuthClient';
import { sanitizeCallbackUrl } from '@/utils/redirect';

interface SignInFormProps {
  callbackUrl?: string;
  showOAuth?: boolean;
  initialError?: string;
}

export function SignInForm({
  callbackUrl = '/arena',
  showOAuth = false,
  initialError,
}: SignInFormProps) {
  // Sanitize callback URL to prevent open redirect vulnerabilities
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  const router = useRouter();
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ? t('SignIn.oauth_error') : '');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to sign in');
        setLoading(false);
        return;
      }

      // Redirect to callback URL or arena
      router.push(safeCallbackUrl);
      router.refresh();
    } catch (_err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: safeCallbackUrl,
        errorCallbackURL: '/sign-in',
      });

      if (result?.error) {
        setError(result.error.message || `Failed to sign in with ${provider}`);
        setLoading(false);
        return;
      }
    } catch (_err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleLinuxdoSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.social({
        provider: 'linuxdo',
        callbackURL: safeCallbackUrl,
        errorCallbackURL: '/sign-in',
      });

      if (result?.error) {
        setError(result.error.message || 'Failed to sign in with Linux.do');
        setLoading(false);
        return;
      }
    } catch (_err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const showLinuxdoOAuth = env.NEXT_PUBLIC_LINUXDO_AUTH_ENABLED === 'true';
  const showForgotPassword = env.NEXT_PUBLIC_EMAIL_ENABLED === 'true';

  return (
    <div className="w-full max-w-md space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              className="w-full px-4 py-2 pr-10 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              disabled={loading}
            />
            {password && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? EyeOffIcon : EyeIcon}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {showForgotPassword && (
          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
        )}
      </form>

      {(showOAuth || showLinuxdoOAuth) && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex gap-3">
            {showOAuth && (
              <>
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>
              </>
            )}

            {showLinuxdoOAuth && (
              <button
                type="button"
                onClick={handleLinuxdoSignIn}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {LinuxdoIcon}
                Linux.do
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
