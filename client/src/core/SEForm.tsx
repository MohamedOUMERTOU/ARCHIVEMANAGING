import { Form as AntdForm, Button, FormProps } from 'antd';
import React from 'react';

interface SEFormProps extends FormProps {
  onSubmit: (values: any) => void; // Update the onSubmit type to receive form values
  disabled?: boolean;
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  confirm?: string; // New prop for confirmation dialog
  children?: React.ReactNode; // Ensure children are typed as React.ReactNode
}

const SEForm: React.FC<SEFormProps> = (params: SEFormProps) => {
  const [form] = AntdForm.useForm();

  const handleFinish = (values: any) => {
    if (params.confirm && !window.confirm(params.confirm)) {
      return; // Exit early if not confirmed
    }
    params.onSubmit(values); // Pass form values to the onSubmit handler
  };

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => handleFinish(values))
      .catch((errorInfo) => {
        // Handle validation errors if needed
        console.error('Validation Failed:', errorInfo);
      });
  };

  return (
    <AntdForm
      {...params}
      form={form}
      onFinish={handleFinish}
    >
      {params.children}
      {/* Include submit button inside the form */}
      <Button
        type="primary"
        onClick={handleSubmit}
        disabled={params.disabled}
        aria-label={params.ariaLabel}
        id={params.id}
        data-testid={params.dataTestId}
      >
        Submit
      </Button>
    </AntdForm>
  );
};

export default SEForm;
