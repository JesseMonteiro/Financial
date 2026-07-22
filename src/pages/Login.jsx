import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Wallet, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import './Login.css';

export function Login() {
  const [mode, setMode] = useState('signin'); // signin, signup, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, loading } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email) {
      setLocalError('Por favor, insira seu email.');
      return;
    }

    try {
      if (mode === 'signin') {
        if (!password) {
          setLocalError('Por favor, insira sua senha.');
          return;
        }
        const { error } = await signIn(email, password);
        if (error) {
          setLocalError(error.message || 'Erro ao entrar.');
        } else {
          navigate('/');
        }
      } else if (mode === 'signup') {
        if (!password || !fullName) {
          setLocalError('Preencha todos os campos.');
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setLocalError(error.message || 'Erro ao criar conta.');
        } else {
          setSuccessMsg('Conta criada! Verifique seu email.');
          setMode('signin');
          setPassword('');
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setLocalError(error.message || 'Erro ao redefinir senha.');
        } else {
          setSuccessMsg('Email de redefinição enviado!');
          setMode('signin');
        }
      }
    } catch (err) {
      setLocalError('Ocorreu um erro inesperado.');
    }
  };

  return (
    <div className="login-page-container">
      <motion.div 
        className="login-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="login-header">
          <div className="login-logo">
            <Wallet size={32} />
          </div>
          <h1 className="login-title">FinanceHub</h1>
          <p className="login-subtitle">Assuma o controle do seu dinheiro</p>
        </div>

        {mode !== 'reset' && (
          <div className="login-tabs">
            <button 
              className={`login-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => { setMode('signin'); setLocalError(''); setSuccessMsg(''); }}
              type="button"
            >
              Entrar
            </button>
            <button 
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setLocalError(''); setSuccessMsg(''); }}
              type="button"
            >
              Criar conta
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="login-tabs">
            <button 
              className="login-tab active"
              onClick={() => { setMode('signin'); setLocalError(''); setSuccessMsg(''); }}
              type="button"
            >
              Voltar para login
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {localError && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="error-message"
            >
              {localError}
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="success-message"
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <motion.div 
              className="input-group"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <User className="input-icon" size={20} />
              <input 
                type="text" 
                className="login-input" 
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </motion.div>
          )}

          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input 
              type="email" 
              className="login-input" 
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'reset' && (
            <div className="input-group">
              <Lock className="input-icon" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                className="login-input" 
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          )}

          {mode === 'signin' && (
            <div className="login-options">
              <button 
                type="button" 
                className="forgot-password-link"
                onClick={() => { setMode('reset'); setLocalError(''); setSuccessMsg(''); }}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={20} />
            ) : (
              <>
                {mode === 'signin' && 'Entrar'}
                {mode === 'signup' && 'Criar conta'}
                {mode === 'reset' && 'Enviar email'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
