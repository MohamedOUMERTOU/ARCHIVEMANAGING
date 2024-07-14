import React, { FC } from 'react';

interface SEButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  confirm?: string; // New prop for confirmation dialog
}

const SEButton: FC<SEButtonProps> = ({
  label,
  onClick,
  disabled = false,
  className = "",
  type = "button",
  style,
  id,
  dataTestId,
  ariaLabel,
  autoFocus,
  tabIndex,
  confirm,
}) => {

  const handleClick = () => {
    if (confirm && window.confirm(confirm)) {
      onClick(); // Call the onClick function if confirmed
    }
  };

  return (
    <button
      className={`se-button ${className}`}
      onClick={handleClick}
      disabled={disabled}
      type={type}
      style={style}
      id={id}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      tabIndex={tabIndex}
    >
      {label}
    </button>
  );
};

export default SEButton;
