import type { CheckboxProps } from "antd";
import { Checkbox, Col } from "antd";
import React from "react";
import SETypography from "./SETypography";

interface SECheckboxProps extends CheckboxProps {
  text: string;
  orientation?: "left" | "right" | "center";
  col?: number;
  onChange?: (e: any) => void;
  label: string;
}

const SECheckbox: React.FC<SECheckboxProps> = ({
  text,
  orientation = "center",
  col = 24,
  onChange,
  label,
  ...checkboxProps
}) => {
  return (
    <Col span={col}>
      {label && <SETypography text={text} level={5} />}{" "}
      {/* Render label if text is provided */}
      <Checkbox {...checkboxProps} onChange={onChange}>
        {text}
      </Checkbox>
    </Col>
  );
};

export default SECheckbox;
