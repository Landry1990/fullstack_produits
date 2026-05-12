import type { ComponentType } from 'react';
import { lazy } from 'react';

// Lazy load recharts components to reduce initial bundle size (~500KB saved)
// Usage: import { LineChart } from './LazyRecharts'

export const LineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart as ComponentType<any> })));
export const Line = lazy(() => import('recharts').then(m => ({ default: m.Line as ComponentType<any> })));
export const BarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart as ComponentType<any> })));
export const Bar = lazy(() => import('recharts').then(m => ({ default: m.Bar as ComponentType<any> })));
export const AreaChart = lazy(() => import('recharts').then(m => ({ default: m.AreaChart as ComponentType<any> })));
export const Area = lazy(() => import('recharts').then(m => ({ default: m.Area as ComponentType<any> })));
export const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis as ComponentType<any> })));
export const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis as ComponentType<any> })));
export const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid as ComponentType<any> })));
export const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip as ComponentType<any> })));
export const Legend = lazy(() => import('recharts').then(m => ({ default: m.Legend as ComponentType<any> })));
export const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer as ComponentType<any> })));
export const Cell = lazy(() => import('recharts').then(m => ({ default: m.Cell as ComponentType<any> })));
export const PieChart = lazy(() => import('recharts').then(m => ({ default: m.PieChart as ComponentType<any> })));
export const Pie = lazy(() => import('recharts').then(m => ({ default: m.Pie as ComponentType<any> })));
export const ReferenceLine = lazy(() => import('recharts').then(m => ({ default: m.ReferenceLine as ComponentType<any> })));
