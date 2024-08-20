import { FC, useContext } from "react";
import { SEContext } from "../../../../context/userSEContext";
import SEButton from "../../../../core/SEButton";
import SEForm from "../../../../core/SEForm";
import SETextInput from "../../../../core/SETextInputs";
import { addMetadata } from "./MetadataApis";

const MetaDataForm: FC = () => {


 
 
 const context = useContext(SEContext);
 if (!context) {
   throw new Error("SEContext must be used within a SEContextProvider");
 }
 const { setCloseDr } = context;
 

  
  const handlerchange = (value: any) => {
    console.log(value);
    
    addMetadata(value);
  };

  return (
    <SEForm onSubmit={handlerchange}>
      <SETextInput name="key" label="Code  metadonnée" onChange={() => {}} />
      <SETextInput name="name" label="Nom metadonnée " onChange={() => {}} />
      
        <SEButton  htmlType="submit"  isSubmit label="sauvegarde"type="primary"   onClick={() => setCloseDr(true)}/>
    </SEForm>
  );
};

export default MetaDataForm;
