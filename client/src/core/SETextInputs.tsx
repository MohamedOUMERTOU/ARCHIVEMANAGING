import React from "react";
import { Input, Form } from "antd";
import type { InputProps } from "antd/lib/input";
import SECol from "./SECol";
import SETypography from "./SETypography"; // Import SETypography for displaying the label

interface SETextInputProps extends Omit<InputProps, "onChange"> {
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
  text?: string; // Add text prop for the label
  name: string; // Add name prop for form registration
}

const SETextInput: React.FC<SETextInputProps> = ({
  onChange,
  placeholder = "",
  disabled = false,
  className = "",
  id,
  autoFocus,
  tabIndex,
  col = 24,
  text,
  name,
  ...restProps
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <SECol span={col}>
      {text && <SETypography text={text} level={5} />} {/* Render label if text is provided */}
      <Form.Item name={name} rules={[{ required: true, message: `${text} is required` }]}>
        <Input
          className={`se-text-input ${className}`}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          {...restProps} // Spread remaining props to Ant Design Input component
        />
      </Form.Item>
    </SECol>
  );
};

export default SETextInput;
