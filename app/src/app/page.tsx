import { Suspense } from 'react';

import { Chat } from '@/components/chat';
import { isLocalInference } from '@/lib/llm/provider';

/*
 * Whether this instance is the hosted demo is derived from the same LLM_BASE_URL
 * the chat route actually uses, resolved here on the server. Deriving it beats a
 * separate NEXT_PUBLIC_ flag, which is a second source of truth that can be left
 * saying "local" on a deployment that is talking to Groq.
 */
export default function Home() {
  return (
    <Suspense fallback={null}>
      <Chat hosted={!isLocalInference()} />
    </Suspense>
  );
}
