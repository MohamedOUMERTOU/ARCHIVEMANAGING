import React from 'react';
import { Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import type { RadioProps } from 'antd';

interface SERadioButtonProps extends Omit<RadioProps, 'onChange'> {
  value?: string | number;
  onChange: (e: RadioChangeEvent) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
}

const SERadioButton: React.FC<SERadioButtonProps> = ({
  value,
  onChange,
  className = "",
  id,
  autoFocus,
  tabIndex,
  ...restProps
}) => {

  const handleChange = (e: RadioChangeEvent) => {
    onChange(e);
  };

  return (
    <Radio
      className={`se-radio-button ${className}`}
      value={value}
      onChange={handleChange}
      id={id}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
      {...restProps}
    />
  );
};

export default SERadioButton;
