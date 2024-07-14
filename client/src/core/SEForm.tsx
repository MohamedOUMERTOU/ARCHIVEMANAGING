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

const SEForm: React.FC<SEFormProps> = (params: SEFormProps) => {

  const handleSubmit = () => {
    if (params.confirm && !window.confirm(params.confirm)) {
      return; // Exit early if not confirmed
    }
    params.onSubmit();
  };

  return (
    <AntdForm {...params}>
      {/* Ensure children are rendered correctly */}
      {params.children}
      <Button
        type="primary"
        htmlType="submit"
        onClick={handleSubmit}
        disabled={params.disabled}
        id={params.id}
        data-testid={params.dataTestId}
        aria-label={params.ariaLabel}
      >
        {params.submitLabel}
      </Button>
    </AntdForm>
  );
};

export default SEForm;
