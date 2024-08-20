import React from 'react';
import { Drawer } from 'antd';
import { Icons } from './SEIcons';

interface SEDrawerProps {
  title: string;
  name?:string;
  children?: React.ReactNode;
  visible: boolean;
  onClose: () => void;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  width?: number | string;
  height?: number | string;
}

const SEDrawer: React.FC<SEDrawerProps> = ({
  title,
  children,
  visible,
  name,
  onClose,
  placement = 'right',
  width = 300,
  height,
}) => {
  return (
    <Drawer
    
      closeIcon={<Icons.CloseOutlined className="red"/>}
      title={title}
      placement={placement}
      onClose={onClose}
      visible={visible}
      width={width}
      height={height}
    >
      {children}
    </Drawer>
  );
};

export default SEDrawer