import api from './api';
import type { OrderSchedule } from '../types/procurement';

const procurementService = {
    getSchedules: async () => {
        const response = await api.get('order-schedules/');
        return response.data;
    },

    getSchedule: async (id: number) => {
        const response = await api.get(`order-schedules/${id}/`);
        return response.data;
    },

    createSchedule: async (schedule: OrderSchedule) => {
        const response = await api.post('order-schedules/', schedule);
        return response.data;
    },

    updateSchedule: async (id: number, schedule: OrderSchedule) => {
        const response = await api.patch(`order-schedules/${id}/`, schedule);
        return response.data;
    },

    deleteSchedule: async (id: number) => {
        const response = await api.delete(`order-schedules/${id}/`);
        return response.data;
    },

    triggerNow: async (id: number) => {
        const response = await api.post(`order-schedules/${id}/trigger-now/`);
        return response.data;
    }
};

export default procurementService;
