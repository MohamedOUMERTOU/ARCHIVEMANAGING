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
  label?: string; // Add text prop for the label
  name: string; // Add name prop for form registration
}

const SETextInput: React.FC<SETextInputProps> = ({
  onChange,
  placeholder = "",
  disabled = false,
  className = "",
  id,
  name,
  autoFocus,
  tabIndex,
  col = 24,
  label,
  ...restProps
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <SECol span={col}>
      {label && <SETypography text={label} level={5}  style={{ marginTop: -2}}/>} {/* Render label if text is provided */}
      <Form.Item 
        name={name} 
        rules={[{ required: true, message: `${label} is required` }]}
        style={{ marginBottom: 2}} // Adjust the bottom margin
      >
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
