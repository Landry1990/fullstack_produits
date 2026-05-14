import type { ComponentType } from 'react';
import { lazy, Suspense, memo, forwardRef } from 'react';
// Import ResponsiveContainer directly - it has issues with lazy loading
import { ResponsiveContainer as RC } from 'recharts';

/**
 * Lazy load helper that wraps the lazy component in a regular functional component.
 */
const createLazyComponent = (name: string) => {
  const LazyComp = lazy(() => import('recharts').then(m => {
    const Component = (m as any)[name];
    if (!Component) {
      console.error(`Recharts component '${name}' not found`);
      return { default: () => null } as any;
    }
    return { default: Component } as any;
  }));
  
  // Simple wrapper without ref forwarding to avoid type issues
  const Component = memo((props: any) => {
    return <LazyComp {...props} />;
  });
  
  Component.displayName = name;
  return Component;
};

// Export ResponsiveContainer directly (not lazy)
export const ResponsiveContainer = RC;

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
// ResponsiveContainer is imported directly above
export const Cell = createLazyComponent('Cell');
export const PieChart = createLazyComponent('PieChart');
export const Pie = createLazyComponent('Pie');
export const ReferenceLine = createLazyComponent('ReferenceLine');


