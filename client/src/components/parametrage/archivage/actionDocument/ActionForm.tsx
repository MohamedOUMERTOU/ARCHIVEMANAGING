import { FC, useContext } from 'react'
import { SEContext } from '../../../../context/userSEContext'
import SEButton from '../../../../core/SEButton'
import SEForm from '../../../../core/SEForm'
import SETextInput from '../../../../core/SETextInputs'
import { addAction } from './ActionApis'
 
const ActionForm :FC= () => {
  const context = useContext(SEContext);

  if (!context) {
    // Handle the case where context is not available
    return <div>Error: SEContext is not available</div>;
  }
  const {setActions } = context;
 

  const handlerchange=(value:any)=>{

    addAction(value)
  
 
  }
  return (
    <SEForm onSubmit={handlerchange}>
    <SETextInput name="name"label="Nom de l'action" onChange={handlerchange}/>
    <SETextInput name="description" label="Description de l'action" onChange={handlerchange}/>
    <SEButton htmlType="submit"  isSubmit label="sauvegarde"type="primary"/>
    </SEForm>
    
  )
}

export default ActionForm
