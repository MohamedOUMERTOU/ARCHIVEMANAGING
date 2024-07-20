import React, { FC, ReactNode } from 'react';
import { Row } from 'antd';

interface SERowProps {
  gutter?: number;
  children: ReactNode;
}

const SERow: FC<SERowProps> = ({ gutter, children }) => {
  return (
    <Row gutter={gutter} style={{margin:"10px"}}>
      {children}
    </Row>
  );
};

export default SERow;
