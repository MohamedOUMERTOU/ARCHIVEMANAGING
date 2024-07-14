import { Button, ButtonProps } from "antd";
import { CSSProperties, FC } from "react";
import React from "react";

interface SEButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  type?: ButtonProps['type'];
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  confirm?: string; // New prop for confirmation dialog
  style?:CSSProperties
  
}

const SEButton: FC<SEButtonProps> = (params: SEButtonProps) => {
  const handleClick = () => {
    if (params.confirm) {
      if (window.confirm(params.confirm)) {
        params.onClick();
      }
    } else {
      params.onClick();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={params.disabled}
      type={params.type}
      aria-label={params.ariaLabel}
      id={params.id}
      data-testid={params.dataTestId}
      style={{...params.style}}
    >
      {params.label}
    </Button>
  );
};

export default SEButton;
