import { FC } from "react";
import SEButton from "../../../../core/SEButton";
import SEForm from "../../../../core/SEForm";
import SETextInput from "../../../../core/SETextInputs";
import { addTypeRefDoc } from "./TypesApis";

const TypeForm: FC = () => {
  const handlerchange = (data: any) => {
    addTypeRefDoc(data);
  };

  return (
    <SEForm onSubmit={handlerchange}>
      <SETextInput
        name="typeName"
        label="Libellé type:"
        onChange={()=> {}}
      />
      <SEButton htmlType="submit" isSubmit label="sauvegarde" type="primary" />
    </SEForm>
  );
};

export default TypeForm;
