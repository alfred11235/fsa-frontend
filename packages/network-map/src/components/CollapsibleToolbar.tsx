import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleToolbarProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  position?: 'top-left' | 'top-right';
  style?: React.CSSProperties;
  className?: string;
}

export default function CollapsibleToolbar({
  title,
  icon,
  children,
  defaultCollapsed = false,
  position = 'top-right',
  style,
  className = '',
}: CollapsibleToolbarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const posClass = position === 'top-left' ? 'left-4' : 'right-4';

  if (collapsed) {
    return (
      <div className={`absolute ${posClass} z-10`} style={style}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 shadow-md transition-colors hover:bg-gray-50"
          title={`Expand ${title}`}
        >
          <span className="text-gray-500">{icon}</span>
          <span className="text-xs font-medium text-gray-600">{title}</span>
          <ChevronDown size={12} className="text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute ${posClass} z-10 ${className}`} style={style}>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => setCollapsed(true)}
          className="flex h-6 items-center justify-center gap-1 rounded-t-md border border-b-0 border-gray-200 bg-gray-50 px-2 text-[10px] font-medium text-gray-500 hover:bg-gray-100"
          title={`Collapse ${title}`}
        >
          <span className="text-gray-400">{icon}</span>
          {title}
          <ChevronUp size={10} className="text-gray-400" />
        </button>
        {children}
      </div>
    </div>
  );
}
