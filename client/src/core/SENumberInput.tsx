import type { InputNumberProps } from "antd";
import { Col, InputNumber } from "antd";
import React from "react";

interface SENumberInputProps
  extends Omit<InputNumberProps<number>, "onChange"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
}

const SENumberInput: React.FC<SENumberInputProps> = ({
  value,
  onChange,
  className = "",
  id,
  autoFocus,
  tabIndex,
  col = 24,
  ...restProps
}) => {
  const handleChange = (newValue: number | null) => {
    onChange(newValue === null ? undefined : newValue);
  };

  return (
    <Col span={col}>
      <InputNumber<number>
        value={value}
        onChange={handleChange}
        id={id}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        {...restProps}
      />
    </Col>
  );
};

export default SENumberInput;
