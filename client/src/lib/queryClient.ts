import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  // Get user from localStorage to include user ID in headers
  const currentUser = localStorage.getItem('currentUser');
  const userId = currentUser ? JSON.parse(currentUser).id : null;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const uiLanguage = localStorage.getItem('language');
  if (uiLanguage) {
    headers["x-language"] = uiLanguage;
  }
  
  // Add user ID header if available
  if (userId) {
    headers["x-user-id"] = userId.toString();
  }
  
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get user from localStorage to include user ID in headers
    const currentUser = localStorage.getItem('currentUser');
    const userId = currentUser ? JSON.parse(currentUser).id : null;
    
    const headers: Record<string, string> = {};

    const uiLanguage = localStorage.getItem('language');
    if (uiLanguage) {
      headers["x-language"] = uiLanguage;
    }
    
    // Add user ID header if available
    if (userId) {
      headers["x-user-id"] = userId.toString();
    }
    
    // Build URL with query parameters
    let url = queryKey[0] as string;
    const params = queryKey[1] as Record<string, string> | undefined;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
