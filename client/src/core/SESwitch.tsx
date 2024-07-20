import type { SwitchProps } from "antd";
import { Col, Switch } from "antd";
import React, { MouseEvent } from "react";
import SETypography from "./SETypography";

interface SESwitchProps extends Omit<SwitchProps, "onChange"> {
  className?: string;
  onChange?: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  col?: number;
  label:string
}

const SESwitch: React.FC<SESwitchProps> = ({
  className = "",
  onChange,
  col = 24,
  label,
  ...restProps
}) => {
  const handleChange = (
    checked: boolean,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    if (onChange) {
      onChange(checked, event);
    }
  };

  return (
    <Col span={col}>
      {label && <SETypography text={label} level={5} />}
      {/* Render label if text is provided */}
      <Switch
        className={`se-switch ${className}`}
        onChange={handleChange}
        {...restProps}
      />
    </Col>
  );
};

export default SESwitch;
