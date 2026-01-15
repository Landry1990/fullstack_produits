import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function PasswordConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const verifyEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/verify-password/`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      await axios.post(verifyEndpoint, { password });
      // If success (200 OK)
      onConfirm();
      onClose();
    } catch (err: any) {
        if (err.response?.status === 403) {
             setError("Mot de passe incorrect.");
             toast.error("Mot de passe incorrect.");
        } else {
             setError("Erreur de vérification.");
             toast.error("Erreur technique lors de la vérification.");
        }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg text-error">{title}</h3>
        <p className="py-4 text-base-content/80 font-medium">
            {message}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Confirmez votre mot de passe pour continuer :</span>
            </label>
            <input
              ref={inputRef}
              type="password"
              placeholder="Votre mot de passe..."
              className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password" 
            />
            {error && (
                <label className="label">
                    <span className="label-text-alt text-error">{error}</span>
                </label>
            )}
          </div>

          <div className="modal-action">
            <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={onClose}
                disabled={loading}
            >
              Annuler
            </button>
            <button 
                type="submit" 
                className="btn btn-error"
                disabled={loading || !password}
            >
              {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
