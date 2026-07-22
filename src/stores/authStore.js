import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      set({
        session,
        user: session?.user || null,
        loading: false,
        error: error?.message || null
      });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user || null,
        loading: false
      });
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ loading: false, error: error?.message || null });
    return { data, error };
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    set({ loading: false, error: error?.message || null });
    return { data, error };
  },

  signOut: async () => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    if (!error) {
      set({ user: null, session: null });
    }
    set({ loading: false, error: error?.message || null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    set({ loading: false, error: error?.message || null });
    return { data, error };
  }
}));
