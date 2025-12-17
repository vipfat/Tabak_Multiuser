import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { MixIngredient } from '../types';
import { MAX_BOWL_SIZE } from '../constants';

interface BowlChartProps {
  mix: MixIngredient[];
  totalWeight: number;
  bowlCapacity?: number;
}

// Helper to determine best text color (black or white) based on background hex
const getContrastYIQ = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    // Remove hash
    const hex = hexcolor.replace("#", "");
    
    // Parse rgb
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate YIQ ratio
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Returns black for bright colors, white for dark colors
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

const BowlChart: React.FC<BowlChartProps> = ({ mix, totalWeight, bowlCapacity = MAX_BOWL_SIZE }) => {
  // Use venue-specific bowl capacity or default
  const capacity = bowlCapacity ?? MAX_BOWL_SIZE;
  
  // Prepare data: Add an "Empty" slice if bowl isn't full
  const remaining = capacity - totalWeight;
  
  const data = [
    ...mix.map(item => ({
      name: item.name,
      value: item.grams,
      color: item.color
    })),
    ...(remaining > 0 ? [{ name: 'Свободно', value: remaining, color: '#334155' }] : [])
  ];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const item = data[index];
    // Safety check: during animations or rapid updates, index might be out of bounds
    if (!item) return null;

    if (item.name === 'Свободно' || percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Determine readable text color
    const textColor = getContrastYIQ(item.color);

    return (
      <text 
        x={x} 
        y={y} 
        fill={textColor} 
        textAnchor="middle" 
        dominantBaseline="central" 
        fontSize={14} 
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full h-64 relative flex items-center justify-center" style={{ minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={150}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={80}
            innerRadius={40}
            fill="#8884d8"
            dataKey="value"
            stroke="none"
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
             contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
             itemStyle={{ color: '#fff' }}
             formatter={(value: number, name: string) => [name === 'Свободно' ? `${value.toFixed(1)}г свободно` : `${value}г`, name === 'Свободно' ? '' : name]}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-white drop-shadow-md">{totalWeight}г</span>
        <span className="text-xs text-slate-400 uppercase tracking-wider">из {bowlCapacity}г</span>
      </div>
    </div>
  );
};

export default BowlChart;