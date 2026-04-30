import { useQuery } from '@tanstack/react-query';
import systemService from '../services/systemService';

export const useAppVersion = () => {
    return useQuery({
        queryKey: ['app-version'],
        queryFn: () => systemService.getVersion(),
        staleTime: 1000 * 60 * 10,
        retry: false,
    });
};
