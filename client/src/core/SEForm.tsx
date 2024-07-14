import React from 'react';
import { Form as AntdForm, Button } from 'antd';
import type { FormProps } from 'antd/lib/form/Form';

interface SEFormProps extends FormProps {
  submitLabel: string;
  onSubmit: () => void;
  disabled?: boolean;
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  confirm?: string; // New prop for confirmation dialog
  children?: React.ReactNode; // Ensure children are typed as React.ReactNode
}

const SEForm: React.FC<SEFormProps> = ({
  submitLabel,
  onSubmit,
  disabled = false,
  id,
  dataTestId,
  ariaLabel,
  confirm,
  children, // Ensure children are correctly typed as React.ReactNode
  ...formProps
}) => {

  const handleSubmit = () => {
    if (confirm && !window.confirm(confirm)) {
      return; // Exit early if not confirmed
    }
    onSubmit();
  };

  return (
    <AntdForm {...formProps}>
      {/* Ensure children are rendered correctly */}
      {children}
      <Button
        type="primary"
        htmlType="submit"
        onClick={handleSubmit}
        disabled={disabled}
        id={id}
        data-testid={dataTestId}
        aria-label={ariaLabel}
      >
        {submitLabel}
      </Button>
    </AntdForm>
  );
};

export default SEForm;
