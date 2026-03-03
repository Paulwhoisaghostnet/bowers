import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run2',hypothesisId:'H6',location:'use-auth.ts:5',message:'fetchUser start',data:{path:'/api/auth/user'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run2',hypothesisId:'H6',location:'use-auth.ts:11',message:'fetchUser unauthorized',data:{status:401},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  }

  if (!response.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run2',hypothesisId:'H6',location:'use-auth.ts:16',message:'fetchUser non-ok response',data:{status:response.status,statusText:response.statusText},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const user = await response.json();
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run2',hypothesisId:'H6',location:'use-auth.ts:22',message:'fetchUser success',data:{hasUser:!!user},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return user;
}

async function doLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: doLogout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
