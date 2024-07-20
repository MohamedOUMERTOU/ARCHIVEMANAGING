import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

interface SETypographyProps {
  text: string;
  level?: 1 | 2 | 3 | 4 | 5;
  style?:React.CSSProperties;
}

const SETypography: React.FC<SETypographyProps> = ({ text, level = 1,style }) => {
  return <Title level={level} style={style}>{text}</Title>;
};

export default SETypography;
