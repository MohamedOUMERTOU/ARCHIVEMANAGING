import { Button, ButtonProps } from 'antd';
import React, { CSSProperties, FC, ReactNode } from 'react';

interface SEButtonProps {
  label: string;
  onClick?: () => void; // Mark onClick as optional
  disabled?: boolean;
  type?: ButtonProps['type'];
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  confirm?: string; // New prop for confirmation dialog
  style?: CSSProperties;
  col?: number;
  icon?: ReactNode; // Add icon property
  isSubmit?: boolean; // New prop to indicate if it's a submit button
}

const SEButton: FC<SEButtonProps> = (params: SEButtonProps) => {
  const handleClick = () => {
    if (params.confirm) {
      if (window.confirm(params.confirm)) {
        params.onClick && params.onClick(); // Invoke onClick if it is provided
      }
    } else {
      params.onClick && params.onClick(); // Invoke onClick if it is provided
    }
  };

  // Determine the button text based on whether it is a submit button or not
  const buttonText = params.isSubmit ? 'Add' : params.label;

  return (
    <Button
      onClick={handleClick}
      disabled={params.disabled}
      type={params.type}
      aria-label={params.ariaLabel}
      id={params.id}
      data-testid={params.dataTestId}
      style={{ ...params.style }}
      icon={params.icon}
      htmlType={params.isSubmit ? 'submit' : 'button'} // Set the HTML type based on the isSubmit prop
    >
      {buttonText}
    </Button>
  );
};

export default SEButton;
