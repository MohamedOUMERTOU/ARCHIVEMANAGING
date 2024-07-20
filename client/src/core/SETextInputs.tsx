import React from "react";
import { Input } from "antd";
import type { InputProps } from "antd/lib/input";
import SECol from "./SECol";

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
  col=24,
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
