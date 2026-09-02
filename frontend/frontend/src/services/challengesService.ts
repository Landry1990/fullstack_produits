import api from './api';
import type {
    Challenge,
    ChallengeClassement,
    ChallengeListParams,
    ChallengeListResponse,
} from '../types';

export const challengesService = {
    list: (params?: ChallengeListParams) =>
        api.get<ChallengeListResponse>('challenges/', { params }).then(res => res.data),
    get: (id: number) =>
        api.get<Challenge>(`challenges/${id}/`).then(res => res.data as Challenge),
    create: (data: Partial<Challenge>) =>
        api.post<Challenge>('challenges/', data).then(res => res.data),
    update: (id: number, data: Partial<Challenge>) =>
        api.put<Challenge>(`challenges/${id}/`, data).then(res => res.data),
    patch: (id: number, data: Partial<Challenge>) =>
        api.patch<Challenge>(`challenges/${id}/`, data).then(res => res.data),
    delete: (id: number) => api.delete(`challenges/${id}/`),
    classement: (id: number) =>
        api.get<ChallengeClassement>(`challenges/${id}/classement/`).then(
            res => res.data as ChallengeClassement
        ),
};

export default challengesService;
