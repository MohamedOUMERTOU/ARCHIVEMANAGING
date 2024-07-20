import type { SwitchProps } from "antd";
import { Col, Switch } from "antd";
import React, { MouseEvent } from "react";

interface SESwitchProps extends Omit<SwitchProps, "onChange"> {
  className?: string;
  onChange?: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  col?: number;
}

const SESwitch: React.FC<SESwitchProps> = ({
  className = "",
  onChange,
  col = 24,
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
      <Switch
        className={`se-switch ${className}`}
        onChange={handleChange}
        {...restProps}
      />
    </Col>
  );
};

export default SESwitch;
