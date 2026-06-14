import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { LogIn, Leaf } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const LoginView: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { login } = useStore();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      login();
      navigate('/');
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || 'Une erreur est survenue lors de la connexion.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#121215] p-4 text-slate-900 dark:text-white">
      <div className="w-full max-w-sm bg-white dark:bg-[#1c1c1f] p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Leaf className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-center">Connexion FBO</h1>
          <p className="text-xs text-slate-500 mt-2 text-center">Accédez à votre espace distributeur</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Se connecter avec Google
        </button>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Nouveau distributeur ?{' '}
            <Link to="/signup" className="text-amber-600 dark:text-amber-500 font-bold hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

