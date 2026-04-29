import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PremiumModal from './PremiumModal';

interface User {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
}

interface SudoValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidate: (validatorId: number, password: string) => void | Promise<void>;
    saving: boolean;
    title?: string;
    message?: string;
    className?: string;
}

export default function SudoValidationModal({ 
    isOpen, 
    onClose, 
    onValidate, 
    saving,
    title,
    message,
    className
}: SudoValidationModalProps) {
    const { t } = useTranslation(['common']);
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedValidator, setSelectedValidator] = useState<number | null>(null);
    const [password, setPassword] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setPassword('');
            setSelectedValidator(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedValidator && isOpen) {
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 100);
        }
    }, [selectedValidator, isOpen]);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const res = await api.get('users/operators/');
            const userList = res.data.results || res.data;
            setUsers(userList);

            if (currentUser) {
                const found = userList.find((u: any) => u.username === currentUser.username);
                if (found) {
                    setSelectedValidator(found.id);
                }
            }
        } catch (err) {
            console.error("Error fetching users", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleConfirm = () => {
        if (selectedValidator && password) {
            onValidate(selectedValidator, password);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={title || t('common:sudo.validate_title')}
            subtitle={t('common:sudo.validate_subtitle')}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            }
            gradientFrom="success/10"
            gradientVia="warning/5"
            gradientTo="success/10"
            disableClose={saving}
            className={className}
        >
            <div className="p-6 space-y-5">
                {message && (
                    <p className="text-sm text-base-content/80 whitespace-pre-wrap">{message}</p>
                )}

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                        {t('common:sudo.validate_as')}
                        <span className="text-warning ml-2 normal-case">{t('common:sudo.validate_admin')}</span>
                    </label>
                    <select 
                        className="select select-bordered w-full h-12 rounded-xl"
                        value={selectedValidator || ''}
                        onChange={(e) => setSelectedValidator(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={loadingUsers}
                    >
                        <option value="" disabled>{t('common:sudo.validate_me')}</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username} ({u.username})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedValidator && (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                            {t('common:sudo.validate_password')}
                            <span className="text-error ml-2 normal-case">{t('common:sudo.validate_required')}</span>
                        </label>
                        <input 
                            ref={passwordInputRef}
                            type="password" 
                            className="input input-bordered w-full h-12 rounded-xl focus:border-success focus:ring-2 focus:ring-success/20 transition-all" 
                            placeholder={t('common:sudo.validate_password')}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={saving}>
                        {t('common:sudo.cancel')}
                    </button>
                    <button 
                        className="btn btn-success px-8 rounded-xl shadow-lg shadow-success/20" 
                        onClick={handleConfirm}
                        disabled={saving || !selectedValidator || !password}
                    >
                        {saving ? <span className="loading loading-spinner"></span> : t('common:sudo.confirm')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}

