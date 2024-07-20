import React from 'react';
import { Divider } from 'antd';

interface SEDividerProps {
  text?: string;
  style?: React.CSSProperties;
  orientation?: 'left' | 'right' | 'center';
}

const SEDivider: React.FC<SEDividerProps> = ({ text, style, orientation = 'center' }) => {
  return <Divider orientation={orientation} style={style}>{text}</Divider>;
};

export default SEDivider;
