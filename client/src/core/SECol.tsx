import React, { FC, ReactNode } from 'react';
import { Col } from 'antd';
import { CSSProperties } from 'react';

interface SEColProps {
  span: number;
  children: ReactNode;
  offset?: number;
  style?: CSSProperties;
}

const SECol: FC<SEColProps> = ({ span, children, offset = 0, style }) => {
  return (
    <Col span={span} offset={offset} style={{ ...style, overflow: 'hidden' }}>
      {children}
    </Col>
  );
};

export default SECol;
