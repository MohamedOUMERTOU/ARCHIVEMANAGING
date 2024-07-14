import React, { ChangeEvent, FocusEvent } from 'react';

interface SETextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  tabIndex?: number;
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
}) => {

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    // Optional: Handle onBlur events if needed
  };

  return (
    <input
      type="text"
      className={`se-text-input ${className}`}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      id={id}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
    />
  );
};

export default SETextInput;
