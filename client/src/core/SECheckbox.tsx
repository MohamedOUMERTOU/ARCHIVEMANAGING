import type {CheckboxProps } from "antd";
import { Checkbox, Col } from "antd";
import React from "react";

interface SECheckboxProps extends CheckboxProps {
  text: string;
  orientation?: "left" | "right" | "center";
  col?: number;
  onChange?: (e: any) => void;
}

const SECheckbox: React.FC<SECheckboxProps> = ({
  text,
  orientation = "center",
  col = 24,
  onChange,
  ...checkboxProps
}) => {
  return (
    <Col span={col}>
      <Checkbox {...checkboxProps} onChange={onChange}>
        {text}
      </Checkbox>
    </Col>
  );
};

export default SECheckbox;
