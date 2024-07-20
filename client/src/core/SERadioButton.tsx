import type { RadioChangeEvent, RadioProps } from "antd";
import { Col, Radio } from "antd";
import React from "react";
import SETypography from "./SETypography";

interface SERadioButtonProps extends Omit<RadioProps, "onChange"> {
  value?: string | number;
  onChange: (e: RadioChangeEvent) => void;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
  text:string;
  label:string
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
  label,
  ...restProps
}) => {
  const handleChange = (e: RadioChangeEvent) => {
    onChange(e);
  };

  return (
    <Col span={col}>
            {label && <SETypography text={label} level={5}/>} {/* Render label if text is provided */}

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
