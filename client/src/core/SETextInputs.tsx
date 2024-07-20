import React from "react";
import { Input } from "antd";
import type { InputProps } from "antd/lib/input";
import SECol from "./SECol";
import SETypography from "./SETypography"; // Import SETypography for displaying the label

interface SETextInputProps extends Omit<InputProps, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  col?: number;
  text?: string; // Add text prop for the label
}

const SETextInput: React.FC<SETextInputProps> = ({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  className = "",
  id,
  autoFocus,
  tabIndex,
  col = 24,
  text,
  ...restProps
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Optional: Handle onBlur events if needed
  };

  return (
    <SECol span={col}>
      {text && <SETypography text={text} level={5}/>} {/* Render label if text is provided */}
      <Input
        className={`se-text-input ${className}`}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        {...restProps} // Spread remaining props to Ant Design Input component
      />
    </SECol>
  );
};

export default SETextInput;
