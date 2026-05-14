import type { ComponentType } from 'react';
import { lazy, Suspense } from 'react';

/**
 * Lazy load helper that wraps the lazy component in a regular functional component.
 * This prevents React 19 "read-only _status" errors when these components are 
 * passed to HOCs or parent components (like ResponsiveContainer) that use cloneElement.
 * 
 * For container components (Charts, ResponsiveContainer), we add a Suspense boundary.
 * For child components (XAxis, Bar, etc.), we don't add Suspense so they can 
 * suspend the parent chart correctly and be identified by Recharts.
 */
const createLazyComponent = (name: string) => {
  const LazyComp = lazy(() => import('recharts').then(m => ({ 
    default: (m as any)[name] as ComponentType<any> 
  })));
  
  const Component = (props: any) => {
    return <LazyComp {...props} />;
  };
  
  Component.displayName = name;
  return Component;
};

export const LineChart = createLazyComponent('LineChart');
export const Line = createLazyComponent('Line');
export const BarChart = createLazyComponent('BarChart');
export const Bar = createLazyComponent('Bar');
export const AreaChart = createLazyComponent('AreaChart');
export const Area = createLazyComponent('Area');
export const XAxis = createLazyComponent('XAxis');
export const YAxis = createLazyComponent('YAxis');
export const CartesianGrid = createLazyComponent('CartesianGrid');
export const Tooltip = createLazyComponent('Tooltip');
export const Legend = createLazyComponent('Legend');
export const ResponsiveContainer = createLazyComponent('ResponsiveContainer');
export const Cell = createLazyComponent('Cell');
export const PieChart = createLazyComponent('PieChart');
export const Pie = createLazyComponent('Pie');
export const ReferenceLine = createLazyComponent('ReferenceLine');


