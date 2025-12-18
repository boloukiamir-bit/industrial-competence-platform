'use client';

import { ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw, Bug, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export type DataStateStatus = 'loading' | 'error' | 'empty' | 'ready';

interface DataStateProps {
  status: DataStateStatus;
  children?: ReactNode;
  
  error?: {
    message: string;
    code?: string;
    hint?: string;
  } | null;
  onRetry?: () => void;
  
  emptyTitle?: string;
  emptyMessage?: string;
  emptyCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  emptyIcon?: ReactNode;
  
  loadingMessage?: string;
  
  minHeight?: string;
}

export function DataState({
  status,
  children,
  error,
  onRetry,
  emptyTitle = 'No data yet',
  emptyMessage = 'Get started by adding your first item.',
  emptyCta,
  emptyIcon,
  loadingMessage = 'Loading...',
  minHeight = '400px',
}: DataStateProps) {
  if (status === 'ready' && children) {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight }} data-testid="state-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6" style={{ minHeight }} data-testid="state-error">
        <div className="p-3 rounded-full bg-destructive/10">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="font-medium text-foreground mb-1">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {error?.message || 'Failed to load data'}
          </p>
          {error?.code && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
              Code: {error.code}
            </p>
          )}
          {error?.hint && (
            <p className="text-xs text-muted-foreground mt-2">
              Hint: {error.hint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" onClick={onRetry} data-testid="button-retry">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
          <Button variant="ghost" asChild data-testid="button-open-debug">
            <Link href="/app/debug">
              <Bug className="w-4 h-4 mr-2" />
              Open Debug
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6" style={{ minHeight }} data-testid="state-empty">
        <div className="p-3 rounded-full bg-muted">
          {emptyIcon || <FileQuestion className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="text-center max-w-md">
          <h3 className="font-medium text-foreground mb-1">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
        {emptyCta && (
          emptyCta.href ? (
            <Button asChild data-testid="button-empty-cta">
              <Link href={emptyCta.href}>{emptyCta.label}</Link>
            </Button>
          ) : (
            <Button onClick={emptyCta.onClick} data-testid="button-empty-cta">
              {emptyCta.label}
            </Button>
          )
        )}
      </div>
    );
  }

  return null;
}

export function useDataState<T>(
  data: T | null | undefined,
  isLoading: boolean,
  error: { message: string; code?: string; hint?: string } | null
): DataStateStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!data || (Array.isArray(data) && data.length === 0)) return 'empty';
  return 'ready';
}
