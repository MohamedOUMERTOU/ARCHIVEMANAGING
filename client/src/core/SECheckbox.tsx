import React from 'react';
import { Checkbox, Divider } from 'antd';
import type { CheckboxProps } from 'antd';

interface SECheckboxProps extends CheckboxProps {
  text: string;
  orientation?: 'left' | 'right' | 'center'; // Optional: Alignment of the text relative to the checkbox
}

const SECheckbox: React.FC<SECheckboxProps> = ({
  text,
  orientation = 'center',
  ...checkboxProps
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {orientation === 'left' && <Divider style={{ margin: '0 20px 0 0' }} />}
      <Checkbox {...checkboxProps}>{text}</Checkbox>
      {orientation === 'center' && <Divider style={{ margin: '0 20px' }} />}
      {orientation === 'right' && <Divider style={{ margin: '0 0 0 20px' }} />}
    </div>
  );
};

export default SECheckbox;
