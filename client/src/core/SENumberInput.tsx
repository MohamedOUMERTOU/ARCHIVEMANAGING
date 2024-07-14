import React from 'react';
import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';

interface SENumberInputProps extends Omit<InputNumberProps<number>, 'onChange'> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
}

const SENumberInput: React.FC<SENumberInputProps> = ({
  value,
  onChange,
  className = "",
  id,
  autoFocus,
  tabIndex,
  ...restProps
}) => {

  const handleChange = (newValue: number | null) => {
    onChange(newValue === null ? undefined : newValue);
  };

  return (
    <InputNumber<number>
      className={`se-number-input ${className}`}
      value={value}
      onChange={handleChange}
      id={id}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
      {...restProps}
    />
  );
};

export default SENumberInput;
