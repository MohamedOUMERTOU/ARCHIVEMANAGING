import { FC, useContext } from "react";
import { SEContext } from "../../../../context/userSEContext";
import SEButton from "../../../../core/SEButton";
import SEForm from "../../../../core/SEForm";
import SETextInput from "../../../../core/SETextInputs";
import { addAction } from "./ActionApis";

const ActionForm: FC = () => {
  const context = useContext(SEContext);
  if (!context) {
    throw new Error("SEContext must be used within a SEContextProvider");
  }
  const { setCloseDr } = context;

  const handlerchange = (value: any) => {
    addAction(value);
  };

  return (
    <SEForm onSubmit={handlerchange}>
      <SETextInput name="name" label="Nom de l'action" onChange={() => {}} />
      <SETextInput
        name="description"
        label="Description de l'action"
        onChange={() => {}}
      />
      <SEButton
        htmlType="submit"
        isSubmit
        label="sauvegarde"
        type="primary"
        onClick={() => setCloseDr(true)}
      />
    </SEForm>
  );
};

export default ActionForm;
