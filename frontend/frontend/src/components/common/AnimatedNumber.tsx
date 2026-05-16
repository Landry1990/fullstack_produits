import React, { useState, useEffect } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    formatValue?: (value: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
    value, 
    duration = 1000,
    formatValue = (v) => v.toString()
}) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (duration <= 0) {
            setDisplayValue(value);
            return;
        }
        let startTime: number | null = null;
        const startValue = displayValue;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Easing function: easeOutExpo
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            
            const current = startValue + (value - startValue) * easeProgress;
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    return <span>{formatValue(displayValue)}</span>;
};
