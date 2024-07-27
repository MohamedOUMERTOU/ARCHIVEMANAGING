import React, { FC } from 'react';
import SEForm from '../../../../core/SEForm';
import SETextInput from '../../../../core/SETextInputs';
import { Button } from 'antd';

const TypeForm: FC = () => {
  const handleSubmit = (values: any) => {
    console.log('Form Values:', values); // values will be an object with keys matching the name attributes of the inputs
    // Handle form submission
  };

  return (
    <SEForm onSubmit={handleSubmit}>
      <SETextInput
        text="Nom type"
        name="name" // This name will be used as the key in the form values
        onChange={(value) => { console.log('Value changed:', value); }}
      />
      <SETextInput
        text="Nom type"
        name="username" // This name will be used as the key in the form values
        onChange={(value) => { console.log('Value changed:', value); }}
      />
      <Button type="primary" htmlType="submit">Ajouter</Button>
    </SEForm>
  );
};

export default TypeForm;
