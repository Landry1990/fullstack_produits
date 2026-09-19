import api from './api';
import type {
    Challenge,
    ChallengeClassement,
    ChallengeListParams,
    ChallengeListResponse,
    ChallengePayload,
} from '../types';

export const challengesService = {
    list: (params?: ChallengeListParams) =>
        api.get<ChallengeListResponse>('challenges/', { params }).then(res => res.data),
    get: (id: number) =>
        api.get<Challenge>(`challenges/${id}/`).then(res => res.data),
    create: (data: ChallengePayload, sudoPassword?: string) => {
        const payload = sudoPassword ? { ...data, sudo_password: sudoPassword } : data;
        return api.post<Challenge>('challenges/', payload).then(res => res.data);
    },
    update: (id: number, data: ChallengePayload, sudoPassword?: string) => {
        const payload = sudoPassword ? { ...data, sudo_password: sudoPassword } : data;
        return api.put<Challenge>(`challenges/${id}/`, payload).then(res => res.data);
    },
    patch: (id: number, data: ChallengePayload, sudoPassword?: string) => {
        const payload = sudoPassword ? { ...data, sudo_password: sudoPassword } : data;
        return api.patch<Challenge>(`challenges/${id}/`, payload).then(res => res.data);
    },
    delete: (id: number, sudoPassword?: string) => {
        const payload = sudoPassword ? { sudo_password: sudoPassword } : {};
        return api.delete(`challenges/${id}/`, { data: payload });
    },
    classement: (id: number) =>
        api.get<ChallengeClassement>(`challenges/${id}/classement/`).then(
            res => res.data as ChallengeClassement
        ),
};

export default challengesService;
