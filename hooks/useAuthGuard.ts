'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthUser } from '@/services/auth';

export function useAuthGuard() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const user = await getAuthUser();
        if (!user && isMounted) {
          router.replace('/login');
        } else if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error checking auth', err);
        if (isMounted) {
          router.replace('/login');
        }
      }
    }

    check();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { loading };
}
