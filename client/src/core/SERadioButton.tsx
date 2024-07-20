import type { RadioChangeEvent, RadioProps } from "antd";
import { Col, Radio } from "antd";
import React from "react";

interface SERadioButtonProps extends Omit<RadioProps, "onChange"> {
  value?: string | number;
  onChange: (e: RadioChangeEvent) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
  text:string
}

const SERadioButton: React.FC<SERadioButtonProps> = ({
  value,
  onChange,
  className = "",
  id,
  autoFocus,
  tabIndex,
  col = 24,
  text,
  ...restProps
}) => {
  const handleChange = (e: RadioChangeEvent) => {
    onChange(e);
  };

  return (
    <Col span={col}>
      <Radio
        className={`se-radio-button ${className}`}
        value={value}
        onChange={handleChange}
        id={id}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        {...restProps}
      >{text}</Radio>
    </Col>
  );
};

export default SERadioButton;
