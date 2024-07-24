import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';

interface SETabsProps extends Omit<TabsProps, 'onChange'> {
  className?: string;
  
  onChange?: (activeKey: string) => void; // Adjust onChange type if necessary
}

const SETabs: React.FC<SETabsProps> = ({
  className = "",
  
  onChange,
  ...restProps
}) => {

  const handleChange = (activeKey: string) => {
    if (onChange) {
      onChange(activeKey);
    }
  };

  return (
    <Tabs
      className={`se-tabs ${className}`}
      onChange={handleChange}
      {...restProps}
    />
  );
};

export default SETabs;
