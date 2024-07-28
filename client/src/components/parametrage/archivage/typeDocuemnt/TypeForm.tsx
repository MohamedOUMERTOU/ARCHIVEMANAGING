import { FC } from "react";
import SEButton from "../../../../core/SEButton";
import SEForm from "../../../../core/SEForm";
import SETextInput from "../../../../core/SETextInputs";
import { addTypeRefDoc } from "./TypesApis";
import SEMessage from "../../../../core/SEMessage";

const TypeForm: FC = () => {
  const addTypeDoc = async (data: any) => {
    try {
      const res: any = await addTypeRefDoc(data);
      if (res.success) {
        SEMessage.success(res.message, 2);
      } else {
        SEMessage.error("Erreur lors de l'ajout de type", 2);
      }
    } catch (error) {
      SEMessage.error("An error occurred while creating the type.", 2);
    }
  };
  return (
    <SEForm onSubmit={addTypeDoc}>
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
