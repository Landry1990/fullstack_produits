import React from 'react';
import { useTranslation } from 'react-i18next';

interface LocalizedDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    type?: 'date';
}

/**
 * Input date natif qui respecte explicitement la langue i18n courante.
 * Le navigateur format l'affichage (mm/dd/yyyy vs dd/mm/yyyy) en fonction de `lang`.
 */
export const LocalizedDateInput: React.FC<LocalizedDateInputProps> = (props) => {
    const { i18n } = useTranslation();
    return (
        <input
            {...props}
            key={`${props.name ?? 'date'}-${i18n.language}-${props.value ?? ''}`}
            type="date"
            lang={i18n.language}
        />
    );
};
