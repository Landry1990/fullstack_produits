import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface User {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
}

interface SudoValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidate: (validatorId: number, password: string) => Promise<void>;
    saving: boolean;
    title?: string;
    message?: string;
}

export default function SudoValidationModal({ 
    isOpen, 
    onClose, 
    onValidate, 
    saving,
    title,
    message 
}: SudoValidationModalProps) {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedValidator, setSelectedValidator] = useState<number | null>(null);
    const [password, setPassword] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setPassword('');
            setSelectedValidator(null);
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
            // Assuming users endpoint is available and accessible
            // We might need a specific endpoint for 'validators' or just all users
            const res = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/api/users/`);
            setUsers(res.data.results || res.data);
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

    if (!isOpen) return null;

    return (
        <dialog className="modal modal-open">
            <div className="modal-box">
                <h3 className="font-bold text-lg">{title || t('stock.inventaire.modals.validate_title')}</h3>
                <p className="py-4" dangerouslySetInnerHTML={{ __html: message || t('stock.inventaire.modals.validate_warning') }}>
                </p>
                
                <div className="form-control w-full max-w-xs mt-2">
                    <label className="label">
                        <span className="label-text">{t('stock.inventaire.modals.validate_as')}</span>
                        <span className="label-text-alt text-warning">{t('stock.inventaire.modals.validate_admin')}</span>
                    </label>
                    <select 
                        className="select select-bordered"
                        value={selectedValidator || ''}
                        onChange={(e) => setSelectedValidator(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={loadingUsers}
                    >
                        <option value="">{t('stock.inventaire.modals.validate_me')}</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username} ({u.username})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedValidator && (
                    <div className="form-control w-full max-w-xs mt-4">
                        <label className="label">
                            <span className="label-text">{t('stock.inventaire.modals.validate_password')}</span>
                            <span className="label-text-alt text-error">{t('stock.inventaire.modals.validate_required')}</span>
                        </label>
                        <input 
                            type="password" 
                            className="input input-bordered" 
                            placeholder={t('stock.inventaire.modals.validate_password')}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                )}

                <div className="modal-action">
                    <button 
                        className="btn btn-ghost" 
                        onClick={onClose}
                        disabled={saving}
                    >
                        {t('stock.inventaire.modals.cancel')}
                    </button>
                    <button 
                        className="btn btn-success" 
                        onClick={handleConfirm}
                        disabled={saving || !selectedValidator || !password}
                    >
                        {saving ? <span className="loading loading-spinner"></span> : t('stock.inventaire.modals.validate_confirm_btn')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
