import React, { useCallback, useEffect, useRef } from 'react';

interface UppercaseInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  excludeUppercase?: boolean;
}

/**
 * Input qui transforme automatiquement les valeurs en majuscules.
 * Ne transforme pas : passwords, emails, et si excludeUppercase=true
 * 
 * Pour la page de login, utiliser excludeUppercase={true}
 */
export const UppercaseInput: React.FC<UppercaseInputProps> = ({
  onChange,
  excludeUppercase = false,
  type = 'text',
  value,
  defaultValue,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  
  // Types qui ne doivent pas être transformés
  const shouldSkipUppercase = excludeUppercase || type === 'password' || type === 'email';
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    if (shouldSkipUppercase) {
      onChange?.(rawValue, e);
      return;
    }
    
    // Transformer en majuscules
    const upperValue = rawValue.toUpperCase();
    
    // Si uncontrolled, mettre à jour la valeur du DOM
    if (!isControlled && inputRef.current) {
      inputRef.current.value = upperValue;
    }
    
    // Appeler le onChange avec la valeur en majuscules
    onChange?.(upperValue, e);
  }, [onChange, shouldSkipUppercase, isControlled]);
  
  // Synchroniser la valeur initiale en majuscules pour les inputs uncontrolled
  useEffect(() => {
    if (!isControlled && inputRef.current && defaultValue && !shouldSkipUppercase) {
      const upperValue = String(defaultValue).toUpperCase();
      if (inputRef.current.value !== upperValue) {
        inputRef.current.value = upperValue;
      }
    }
  }, [defaultValue, isControlled, shouldSkipUppercase]);
  
  return (
    <input
      ref={inputRef}
      type={type}
      value={isControlled ? (shouldSkipUppercase ? value : String(value).toUpperCase()) : undefined}
      defaultValue={!isControlled ? (shouldSkipUppercase ? defaultValue : String(defaultValue || '').toUpperCase()) : undefined}
      onChange={handleChange}
      {...props}
    />
  );
};

/**
 * Hook pour créer un handler onChange simple qui met à jour le state
 * avec la valeur en majuscules
 */
export function useUppercaseChange(
  setter: (value: string) => void,
  options: { exclude?: boolean; type?: string } = {}
) {
  return useCallback((value: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (options.exclude || options.type === 'password' || options.type === 'email') {
      setter(value);
    } else {
      setter(value.toUpperCase());
    }
  }, [setter, options.exclude, options.type]);
}
