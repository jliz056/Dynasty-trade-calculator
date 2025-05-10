import { supabase } from '../../supabaseClient.js';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export const registerWithEmail = async (
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthUser> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to register');
  }
  const { id, email: emailAddr, user_metadata } = data.user;
  return {
    id,
    email: emailAddr ?? undefined,
    displayName: user_metadata?.full_name ?? undefined,
    photoURL: user_metadata?.avatar_url ?? undefined,
  };
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to login');
  }
  const { id, email: emailAddr, user_metadata } = data.user;
  return {
    id,
    email: emailAddr ?? undefined,
    displayName: user_metadata?.full_name ?? undefined,
    photoURL: user_metadata?.avatar_url ?? undefined,
  };
};

export const logout = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || 'Failed to logout');
};

export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    callback(
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? undefined,
            displayName: session.user.user_metadata?.full_name ?? undefined,
            photoURL: session.user.user_metadata?.avatar_url ?? undefined,
          }
        : null,
    );
  });
  return () => listener.subscription.unsubscribe();
}; 