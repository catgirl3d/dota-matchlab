import { ClerkProvider } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { clientConfig, hasClerkConfig } from './lib/config';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const app = (
  <QueryClientProvider client={queryClient}>
    <App clerkEnabled={hasClerkConfig} />
  </QueryClientProvider>
);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element was not found');
}

createRoot(root).render(
  <StrictMode>
    {hasClerkConfig ? (
      <ClerkProvider
        publishableKey={clientConfig.clerkPublishableKey}
        afterSignOutUrl="/"
      >
        {app}
      </ClerkProvider>
    ) : (
      app
    )}
  </StrictMode>,
);
