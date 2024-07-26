import { Form as AntdForm, FormProps } from 'antd';
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

  return (
    <AntdForm
      {...params}
      form={form}
      onFinish={handleFinish}
    >
      {params.children}
    </AntdForm>
  );
};

export default SEForm;
