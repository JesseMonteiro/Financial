import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: () => {
    console.log('[AuthStore] Inicializando sessão do Supabase...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[AuthStore] Sessão obtida no getSession:', { session, error });
      set({
        session,
        user: session?.user || null,
        loading: false,
        error: error?.message || null
      });
    }).catch(err => {
      console.error('[AuthStore] Erro ao obter sessão inicial:', err);
      set({ loading: false });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthStore] onAuthStateChange disparado:', _event, session?.user?.email);
      set({
        session,
        user: session?.user || null,
        loading: false
      });
    });
  },

  signIn: async (email, password) => {
    console.log('[AuthStore] Iniciando signIn para:', email);
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('[AuthStore] Resposta do signIn:', { data, error });
      set({ loading: false, error: error?.message || null });
      return { data, error };
    } catch (err) {
      console.error('[AuthStore] Erro crítico no signIn:', err);
      set({ loading: false, error: err.message || 'Erro inesperado' });
      return { data: null, error: err };
    }
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
      // Redireciona e recarrega para limpar todos os estados dos stores do Zustand da memória
      window.location.href = '/login';
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
