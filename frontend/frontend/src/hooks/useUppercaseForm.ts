import { useCallback } from 'react';

/**
 * Hook pour transformer automatiquement les valeurs de formulaire en majuscules.
 * Utiliser dans les onChange handlers des inputs.
 * 
 * Exemple:
 * const handleChange = useUppercaseOnChange();
 * <input onChange={handleChange} />
 */
export function useUppercaseOnChange() {
  return useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.value;
    
    // Ne pas transformer si déjà en majuscules ou si c'est un mot de passe
    if (target.type === 'password' || target.type === 'email') {
      return value;
    }
    
    // Transformer en majuscules
    const upperValue = value.toUpperCase();
    
    // Mettre à jour la valeur du DOM directement pour refléter visuellement
    if (target.value !== upperValue) {
      target.value = upperValue;
    }
    
    return upperValue;
  }, []);
}

/**
 * Transforme une valeur en majuscules (sauf si c'est un mot de passe ou email)
 */
export function toUppercaseValue(value: string, type?: string): string {
  if (type === 'password' || type === 'email') {
    return value;
  }
  return value.toUpperCase();
}

/**
 * Hook pour créer un handler onChange qui met à jour le state en majuscules
 * 
 * Exemple:
 * const [name, setName] = useState('');
 * const handleChange = useUppercaseSetter(setName);
 * <input value={name} onChange={handleChange} />
 */
export function useUppercaseSetter(setter: (value: string) => void, type?: string) {
  return useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | string) => {
    if (typeof e === 'string') {
      setter(toUppercaseValue(e, type));
    } else {
      const value = e.target.value;
      setter(toUppercaseValue(value, type));
    }
  }, [setter, type]);
}

/**
 * Transforme un objet de valeurs en majuscules (utile avant envoi API)
 */
export function uppercaseValues<T extends Record<string, any>>(obj: T, excludeKeys: string[] = []): T {
  const result = { ...obj };
  
  for (const key in result) {
    if (excludeKeys.includes(key)) continue;
    
    const value = result[key];
    if (typeof value === 'string') {
      // Ne pas transformer les emails, URLs, mots de passe
      if (key.includes('email') || key.includes('password') || key.includes('url') || key.includes('token')) {
        continue;
      }
      (result as any)[key] = value.toUpperCase();
    }
  }
  
  return result;
}
