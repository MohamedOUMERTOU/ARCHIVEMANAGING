import { Button } from 'antd';
import { FC } from 'react';

interface SEButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  type?: "default" | "primary" | "ghost" | "dashed" | "link" | "text";
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  confirm?: string; // New prop for confirmation dialog
}

const SEButton: FC<SEButtonProps> = ({
  label,
  onClick,
  disabled = false,
  type = "default",
  id,
  dataTestId,
  ariaLabel,
  confirm,
}) => {

  const handleClick = () => {
    if (confirm && window.confirm(confirm)) {
      onClick(); // Call the onClick function if confirmed
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled}
      id={id}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    >
      {label}
    </Button>
  );
};

export default SEButton;
